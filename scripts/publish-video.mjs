#!/usr/bin/env node
/**
 * Video publish CLI: encodes (or remuxes) a master, uploads it to R2 with a
 * poster still, and writes the content file. Needs ffmpeg and ffprobe.
 *
 * Usage: `npm run publish-video -- <folder> <slug> <path-to-source-video>`
 */
import { createReadStream } from "node:fs";
import { readFile, stat, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import {
  buildEncodeArgs,
  buildRemuxArgs,
  buildProbeArgs,
  parseProbe,
  chooseStrategy,
  ceilingKbpsFor,
  buildPosterArgs,
  posterTimeFor,
  videoKeyFor,
  MAX_HEIGHT,
  CRF,
} from "./lib/video-encode.mjs";
import { r2ClientFromEnv, uploadDerivative, contentTypeFor, requireR2Env } from "./lib/r2-client.mjs";
import { generateDerivatives } from "./lib/sharp-derivatives.mjs";
import {
  DERIVATIVE_WIDTHS,
  DERIVATIVE_FORMATS,
  MAX_LONG_EDGE,
  buildDerivativeKey,
} from "../shared/media-config.mjs";
import { WORK_FOLDERS, parseWorkFolder } from "../shared/work-categories.mjs";
import {
  applyAboutFields,
  upsertWorkEntry,
  wasCreated,
  readJson,
  writeJson,
} from "../shared/content-files.mjs";

/** "about" holds the showreel; every project video goes under its category. */
const REEL_FOLDER = "about";

/**
 * @param {number} bytes
 * @returns {string} e.g. `"46.3 MB"`.
 */
function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Run a command and capture its stdout instead of inheriting it — used for
 * ffprobe's JSON.
 *
 * @param {string} command
 * @param {string[]} args
 * @returns {Promise<string>}
 */
function capture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (err += chunk));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(out) : reject(new Error(err.trim() || `${command} exited with ${code}`))
    );
  });
}

/**
 * Run a command, inheriting its stderr so ffmpeg's progress stays visible — an
 * encode of a long master takes minutes and a silent terminal looks like a
 * hang.
 *
 * @param {string} command
 * @param {string[]} args
 * @returns {Promise<void>}
 */
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "inherit"] });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`))
    );
  });
}

/**
 * @param {string[]} argv `[folder, slug, sourcePath]`.
 * @returns {Promise<void>}
 */
async function main([category, slug, sourcePath]) {
  if (!category || !slug || !sourcePath) {
    console.error("Usage: npm run publish-video -- <folder> <slug> <path-to-video>");
    console.error("");
    console.error(`  folder   ${WORK_FOLDERS.join(" | ")} | ${REEL_FOLDER}`);
    console.error("  slug     the filename part of the key, no extension");
    console.error("  path     the source video on your disk (quote it if it has spaces)");
    console.error("");
    console.error("Example: npm run publish-video -- work/commercial silent-sprint ~/Movies/sprint.mov");
    process.exit(1);
  }
  const dest = parseWorkFolder(category);
  if (!dest || (!dest.isWork && dest.prefix !== REEL_FOLDER)) {
    console.error(
      `Unknown folder "${category}". A project video goes in one of ` +
        `${WORK_FOLDERS.join(", ")} — the category is part of the key — and the ` +
        `showreel in "${REEL_FOLDER}".`
    );
    process.exit(1);
  }

  requireR2Env();

  let sourceSize;
  try {
    sourceSize = (await stat(sourcePath)).size;
  } catch (error) {
    if (error.code === "ENOENT") {
      console.error(`No such file: ${sourcePath}`);
      if (/^\/Users\/[^/]+\/Users\//.test(sourcePath)) {
        console.error(
          "\nThat path contains your home directory twice. `~` already expands to\n" +
            "/Users/<you>, so write `~/Movies/clip.mov`, not `~/Users/<you>/Movies/clip.mov`."
        );
      }
      console.error("\nNothing was uploaded.");
      process.exit(1);
    }
    throw error;
  }

  const key = videoKeyFor(dest.prefix, slug);
  const workDir = await mkdtemp(join(tmpdir(), "publish-video-"));
  const encodedPath = join(workDir, "encoded.mp4");

  try {
    let probe;
    try {
      probe = parseProbe(await capture("ffprobe", buildProbeArgs(sourcePath)));
    } catch (error) {
      if (error.code === "ENOENT") {
        console.error(
          "\nffmpeg is not installed. Install it with:\n  brew install ffmpeg\nNothing was uploaded."
        );
        process.exit(1);
      }
      console.error(`\nCould not read that file as video: ${error.message}`);
      console.error("Nothing was uploaded.");
      process.exit(1);
    }

    const { action, reason } = chooseStrategy(probe);
    const ceiling = ceilingKbpsFor(probe.bitrateKbps);
    console.log(
      `Source: ${mb(sourceSize)}, ${probe.height}p ${probe.codec}, ${Math.round(probe.duration)}s` +
        (probe.bitrateKbps ? `, ${probe.bitrateKbps} kbps` : "")
    );
    console.log(`${action === "remux" ? "Repackaging" : "Re-encoding"}: ${reason}`);
    if (action === "encode") {
      console.log(
        `Target ${MAX_HEIGHT}p at CRF ${CRF}` +
          (ceiling ? `, capped at ${ceiling} kbps so it cannot end up larger than the source` : "") +
          ". Roughly real time — leave it running."
      );
    }
    console.log("");

    try {
      const args =
        action === "remux"
          ? buildRemuxArgs(sourcePath, encodedPath)
          : buildEncodeArgs(sourcePath, encodedPath, { maxrateKbps: ceiling ?? undefined });
      await run("ffmpeg", args);
    } catch (error) {
      console.error(`\n${action === "remux" ? "Repackaging" : "Encoding"} failed — see ffmpeg's output above. Nothing was uploaded.`);
      process.exit(1);
    }

    const encodedSize = (await stat(encodedPath)).size;
    const delta = Math.round((1 - encodedSize / sourceSize) * 100);
    console.log(
      `Result: ${mb(sourceSize)} → ${mb(encodedSize)} ` +
        (delta > 0 ? `(${delta}% smaller)` : delta === 0 ? "(same size)" : `(${-delta}% larger)`)
    );

    const client = r2ClientFromEnv();

    console.log(`Uploading ${key}…`);
    try {
      await uploadDerivative(client, {
        bucket: process.env.R2_BUCKET_NAME,
        key,
        body: createReadStream(encodedPath),
        contentType: contentTypeFor("mp4"),
        contentLength: encodedSize,
      });
    } catch (error) {
      console.error(`\nUpload failed: ${error.message}`);
      console.error("Nothing usable is in the bucket for this video — rerun when fixed.");
      process.exit(1);
    }

    console.log(`Uploaded ${key}`);

    // A project card needs a still. Pulling one from the video means a new
    // project works immediately; publishing a chosen frame later to the same
    // base key overwrites it.
    let thumbnail = null;
    if (dest.isWork) {
      try {
        const posterPath = join(workDir, "poster.png");
        await run("ffmpeg", buildPosterArgs(encodedPath, posterPath, posterTimeFor(probe.duration)));
        const posterBuffer = await readFile(posterPath);
        const { derivatives, width: capW, height: capH } = await generateDerivatives(posterBuffer, {
          widths: DERIVATIVE_WIDTHS,
          formats: DERIVATIVE_FORMATS,
          maxLongEdge: MAX_LONG_EDGE,
        });
        const baseKey = `${dest.prefix}/${slug}-thumb`;
        for (const { width, format, buffer } of derivatives) {
          await uploadDerivative(client, {
            bucket: process.env.R2_BUCKET_NAME,
            key: buildDerivativeKey(baseKey, width, format),
            body: buffer,
            contentType: contentTypeFor(format),
          });
        }
        const producedWidths = [...new Set(derivatives.map((d) => d.width))].sort((a, b) => a - b);
        thumbnail = {
          baseKey,
          widths: producedWidths.length < DERIVATIVE_WIDTHS.length ? producedWidths : null,
        };
        console.log(`Thumbnail: frame at ${posterTimeFor(probe.duration).toFixed(1)}s → ${baseKey} (${capW}x${capH})`);
      } catch (error) {
        // Not fatal: the video is already uploaded and usable. Say so rather
        // than failing a long job over a still.
        console.error(`\nCould not make a thumbnail from the video: ${error.message}`);
        console.error("The video uploaded fine — publish a still yourself with publish-image.");
      }
    }

    // Write the content file rather than printing lines to paste.
    if (!dest.isWork) {
      const about = await readJson("about.json");
      await writeJson("about.json", applyAboutFields(about, { reelVideoKey: key }));
      console.log(`\nUpdated src/content/about.json — reelVideoKey.`);
    } else {
      const work = await readJson("work.json");
      const created = wasCreated(work, slug);
      await writeJson(
        "work.json",
        upsertWorkEntry(
          work,
          slug,
          {
            videoKey: key,
            ...(thumbnail ? { thumbnailKey: thumbnail.baseKey, thumbnailWidths: thumbnail.widths } : {}),
          },
          { category: dest.category }
        )
      );
      if (created) {
        console.log(`\nCreated a new project in src/content/work.json: "${slug}" (${dest.category}).`);
        console.log("Fill in its title, year and credits — it is listed on the site now.");
      } else {
        console.log(
          `\nUpdated src/content/work.json — videoKey${thumbnail ? " and thumbnailKey" : ""} for "${slug}".`
        );
      }
    }
  } finally {
    // The encode can be hundreds of megabytes; never leave it in /tmp.
    await rm(workDir, { recursive: true, force: true });
  }
}

main(process.argv.slice(2));

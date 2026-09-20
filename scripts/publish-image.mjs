#!/usr/bin/env node
/**
 * Image publish CLI: uploads every derivative to R2 and writes the content
 * file, so the `widths` list cannot be forgotten.
 *
 * Usage: `npm run publish-image -- <folder> <slug> <path-to-source-image>`
 */
import { readFile } from "node:fs/promises";
import { DERIVATIVE_WIDTHS, DERIVATIVE_FORMATS, MAX_LONG_EDGE, buildDerivativeKey } from "../shared/media-config.mjs";
import { generateDerivatives } from "./lib/sharp-derivatives.mjs";
import { r2ClientFromEnv, uploadDerivative, contentTypeFor, requireR2Env } from "./lib/r2-client.mjs";
import { WORK_FOLDERS, parseWorkFolder } from "../shared/work-categories.mjs";
import {
  applyAboutFields,
  applyPhotographyEntry,
  applyRecognitionPoster,
  upsertWorkEntry,
  readJson,
  writeJson,
} from "../shared/content-files.mjs";

/**
 * @param {string[]} argv `[folder, slug, sourcePath]`.
 * @returns {Promise<void>}
 */
async function main([category, slug, sourcePath]) {
  if (!category || !slug || !sourcePath) {
    console.error("Usage: npm run publish-image -- <folder> <slug> <path-to-source-image>");
    console.error("");
    console.error(`  folder     photography | news | about | ${WORK_FOLDERS.join(" | ")}`);
    console.error("  slug       the filename part of the key, no extension");
    console.error("  path       the source image on your disk (quote it if it has spaces)");
    console.error("");
    console.error("Example: npm run publish-image -- news pairpigeons-poster ~/Desktop/pairpigeons.jpg");
    process.exit(1);
  }

  const dest = parseWorkFolder(category);
  if (!dest || (!dest.isWork && !["photography", "news", "about"].includes(dest.prefix))) {
    console.error(
      `Unknown folder "${category}". Use photography, news, about, or one of ` +
        `${WORK_FOLDERS.join(", ")} — a project thumbnail lives beside its video.`
    );
    process.exit(1);
  }

  requireR2Env();

  // A missing source file is the most likely first-run mistake, and Node's
  // raw ENOENT stack trace buries the one useful fact: the path it tried.
  let source;
  try {
    source = await readFile(sourcePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      console.error(`No such file: ${sourcePath}`);
      if (/^\/Users\/[^/]+\/Users\//.test(error.path ?? "")) {
        console.error(
          "\nThat path contains your home directory twice. `~` already expands to\n" +
            "/Users/<you>, so write `~/Pictures/photo.jpg`, not\n" +
            "`~/Users/<you>/Pictures/photo.jpg`."
        );
      }
      console.error("\nNothing was uploaded.");
      process.exit(1);
    }
    throw error;
  }
  const baseKey = `${dest.prefix}/${slug}`;

  // width/height here are the CAPPED image's dimensions, not the source's:
  // these numbers land in photography.json and become PhotoSwipe's declared
  // slide size, and the lightbox link serves the capped derivative. Note
  // withoutEnlargement means a source smaller than the cap keeps its own
  // size, so this cannot simply be hardcoded to MAX_LONG_EDGE.
  const { derivatives, width, height } = await generateDerivatives(source, {
    widths: DERIVATIVE_WIDTHS,
    formats: DERIVATIVE_FORMATS,
    maxLongEdge: MAX_LONG_EDGE,
  });
  const producedWidths = [...new Set(derivatives.map((d) => d.width))].sort((a, b) => a - b);

  const client = r2ClientFromEnv();

  const uploaded = [];
  for (const { width, format, buffer } of derivatives) {
    const key = buildDerivativeKey(baseKey, width, format);
    try {
      await uploadDerivative(client, {
        bucket: process.env.R2_BUCKET_NAME,
        key,
        body: buffer,
        contentType: contentTypeFor(format),
      });
    } catch (error) {
      console.error(
        `\nFailed uploading ${key} — ${uploaded.length}/${derivatives.length} derivatives had already uploaded.`
      );
      if (uploaded.length > 0) {
        console.error("Already in the bucket for this photo:");
        for (const done of uploaded) console.error(`  ${done}`);
        console.error(
          "A partial set means some viewport widths would 404 while others load."
        );
      }
      console.error(
        "Re-run the same command to retry — uploads are keyed writes, so retrying overwrites rather than duplicating."
      );
      throw error;
    }
    uploaded.push(key);
    console.log(`Uploaded ${key}`);
  }

  console.log(`\nDerivative widths produced: ${producedWidths.join(", ")}`);
  const partial = producedWidths.length < DERIVATIVE_WIDTHS.length;
  if (partial) {
    console.log(
      `\nYour original is smaller than ${MAX_LONG_EDGE}px, so only these sizes were made ` +
        `(photos are never enlarged). The site must be told, or larger screens will ` +
        `ask for sizes that don't exist and show a broken image.`
    );
  }

  // Only photography gets a whole JSON entry; other uploads fill one or two
  // fields in an existing file, so print exactly those lines.
  const widths = partial ? producedWidths : null;

  // Write the content file rather than asking for a copy-paste: the widths
  // list is the one thing that is easy to miss and, when missed, makes a
  // high-density screen request a size that does not exist.
  if (baseKey === "about/hero" || baseKey === "about/portrait") {
    const field = baseKey === "about/hero" ? "heroImageKey" : "portraitKey";
    const widthsField = baseKey === "about/hero" ? "heroImageWidths" : "portraitWidths";
    const about = await readJson("about.json");
    await writeJson("about.json", applyAboutFields(about, { [field]: baseKey, [widthsField]: widths }));
    console.log(`\nUpdated src/content/about.json — ${field}${widths ? ` and ${widthsField}` : ""}.`);
    if (baseKey === "about/portrait") console.log("Set portraitAlt yourself if it still describes an older photo.");
    return;
  }

  if (dest.isWork) {
    const work = await readJson("work.json");
    const projectSlug = slug.replace(/-thumb$/, "");
    try {
      await writeJson(
        "work.json",
        upsertWorkEntry(work, projectSlug, { thumbnailKey: baseKey, thumbnailWidths: widths }, { create: false })
      );
      console.log(`\nUpdated src/content/work.json — thumbnailKey for "${projectSlug}".`);
    } catch (error) {
      console.error(`\nUploaded, but could not update work.json: ${error.message}`);
      process.exit(1);
    }
    return;
  }

  // Without this, a news poster would fall through to the photography branch
  // below and be added to the photo wall — uploaded correctly, then filed in
  // the wrong section.
  if (dest.prefix === "news") {
    const recognition = await readJson("recognition.json");
    await writeJson(
      "recognition.json",
      applyRecognitionPoster(recognition, { posterKey: baseKey, posterWidths: widths })
    );
    console.log(`\nUpdated src/content/recognition.json — film.posterKey${widths ? " and film.posterWidths" : ""}.`);
    console.log("Fill in the film's title, year, role, logline and posterAlt.");
    return;
  }

  const photos = await readJson("photography.json");
  await writeJson(
    "photography.json",
    applyPhotographyEntry(photos, {
      slug,
      imageKey: baseKey,
      width,
      height,
      widths,
    })
  );
  console.log(`\nUpdated src/content/photography.json — entry "${slug}".`);
  console.log("Fill in its caption, location and year.");
}

main(process.argv.slice(2));

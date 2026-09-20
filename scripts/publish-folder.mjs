#!/usr/bin/env node
/**
 * Batch publish CLI: publishes every media file in a folder.
 *
 * Usage: `npm run publish-folder -- <folder> <disk-folder> [--force]`
 */
import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { selectMediaFiles, slugFromFilename } from "../shared/batch.mjs";
import { r2ClientFromEnv, requireR2Env, listKeys } from "./lib/r2-client.mjs";
import { buildDerivativeKey } from "../shared/media-config.mjs";
import { WORK_FOLDERS, parseWorkFolder } from "../shared/work-categories.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));

/**
 * Publish one file by running the single-file CLI as its own process, so
 * uploading, thumbnailing and content-file writing have one implementation
 * rather than a second copy that can drift from it.
 *
 * @param {{ prefix: string, isWork: boolean }} dest
 * @param {string} slug
 * @param {string} path Source file on disk.
 * @returns {Promise<boolean>} Whether the child exited cleanly.
 */
function publishOne(dest, slug, path) {
  const script = dest.isWork ? "publish-video.mjs" : "publish-image.mjs";
  return new Promise((resolve) => {
    const child = spawn("node", [join(HERE, script), dest.prefix, slug, path], {
      stdio: ["ignore", "inherit", "inherit"],
    });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

/**
 * The key that proves a file is already published: the object itself for a
 * video, one derivative for an image — if that exists, the set does.
 *
 * @param {{ prefix: string, isWork: boolean }} dest
 * @param {string} slug
 * @returns {string}
 */
function existingKeyFor(dest, slug) {
  if (dest.isWork) return `${dest.prefix}/${slug}.mp4`;
  return buildDerivativeKey(`${dest.prefix}/${slug}`, 640, "webp");
}

/**
 * @param {string[]} argv `[folder, diskFolder]`, plus an optional `--force`.
 * @returns {Promise<void>}
 */
async function main(argv) {
  const force = argv.includes("--force");
  const [category, folder] = argv.filter((a) => a !== "--force");

  if (!category || !folder) {
    console.error("Usage: npm run publish-folder -- <destination> <folder> [--force]");
    console.error("");
    console.error(`  destination   photography | ${WORK_FOLDERS.join(" | ")}`);
    console.error("  folder        the folder on your disk to publish every file from");
    console.error("");
    console.error("Example: npm run publish-folder -- work/commercial ~/Videos/commercials");
    process.exit(1);
  }
  const dest = parseWorkFolder(category);
  if (!dest || (!dest.isWork && dest.prefix !== "photography")) {
    console.error(
      `Unknown destination "${category}". Use "photography", or one of ` +
        `${WORK_FOLDERS.join(", ")} — each category is published from its own folder.`
    );
    process.exit(1);
  }

  requireR2Env();

  let filenames;
  try {
    filenames = await readdir(folder);
  } catch (error) {
    console.error(
      error.code === "ENOENT" ? `No such folder: ${folder}` : `Could not read ${folder}: ${error.message}`
    );
    process.exit(1);
  }

  const files = selectMediaFiles(filenames, dest.isWork ? "work" : dest.prefix);
  if (files.length === 0) {
    const kind = dest.isWork ? "videos" : "images";
    console.error(`No ${kind} found in ${folder}.`);
    console.error(`It holds ${filenames.length} entries, none with an extension this publishes.`);
    process.exit(1);
  }

  const client = r2ClientFromEnv();
  const existing = force ? new Set() : await listKeys(client, process.env.R2_BUCKET_NAME);

  const planned = files.map((name) => ({ name, slug: slugFromFilename(name) }));

  // Two files can reduce to the same slug ("Shot 1.jpg" and "shot-1.jpg").
  // Publishing both would silently overwrite one with the other.
  const seen = new Map();
  const collisions = [];
  for (const item of planned) {
    if (seen.has(item.slug)) collisions.push([seen.get(item.slug), item.name, item.slug]);
    else seen.set(item.slug, item.name);
  }
  if (collisions.length > 0) {
    console.error("These files would be published under the same name, overwriting each other:\n");
    for (const [first, second, slug] of collisions) {
      console.error(`  "${first}" and "${second}" both become "${slug}"`);
    }
    console.error("\nRename one of each pair and run again. Nothing was uploaded.");
    process.exit(1);
  }

  const todo = planned.filter((item) => force || !existing.has(existingKeyFor(dest, item.slug)));
  const skipped = planned.length - todo.length;

  console.log(`${planned.length} file(s) in ${folder}`);
  if (skipped > 0) console.log(`${skipped} already published — skipping (use --force to redo them)`);
  if (todo.length === 0) {
    console.log("\nNothing to do.");
    return;
  }
  console.log(`Publishing ${todo.length}:\n`);

  const failures = [];
  for (const [index, item] of todo.entries()) {
    console.log(`── [${index + 1}/${todo.length}] ${item.name} → ${item.slug}`);
    // Sequential on purpose: encoding saturates the CPU, and both CLIs
    // read-modify-write the same content file.
    const ok = await publishOne(dest, item.slug, resolve(folder, item.name));
    if (!ok) failures.push(item.name);
    console.log("");
  }

  console.log("─".repeat(50));
  console.log(`Published ${todo.length - failures.length} of ${todo.length}.`);
  if (skipped > 0) console.log(`Skipped ${skipped} already in the bucket.`);
  if (failures.length > 0) {
    console.log(`\nFailed (${failures.length}) — the others are fine, rerun to retry just these:`);
    for (const name of failures) console.log(`  ${name}`);
    process.exit(1);
  }
  if (dest.isWork) console.log(`\nEdit each new project's title, year and credits in work.json.`);
  else console.log("\nFill in each new entry's caption, location and year.");
}

main(process.argv.slice(2));

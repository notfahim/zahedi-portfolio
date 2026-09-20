#!/usr/bin/env node
/**
 * Audit CLI: every key the content files reference against what R2 holds.
 *
 * Usage: `npm run check-media`
 */
import { r2ClientFromEnv, listKeys } from "./lib/r2-client.mjs";
import { expectedMediaKeys, missingMedia, orphanedMedia } from "../shared/media-audit.mjs";
import { readJson } from "../shared/content-files.mjs";

/** @returns {Promise<void>} */
async function main() {
  const [work, photography, about, recognition] = await Promise.all([
    readJson("work.json"),
    readJson("photography.json"),
    readJson("about.json"),
    readJson("recognition.json"),
  ]);

  const client = r2ClientFromEnv();
  const bucketKeys = await listKeys(client, process.env.R2_BUCKET_NAME);

  const expected = expectedMediaKeys({ work, photography, about, recognition });
  const missing = missingMedia(expected, bucketKeys);
  const orphaned = orphanedMedia(expected, bucketKeys);

  console.log(`${expected.length} objects referenced by the content files, ${bucketKeys.size} in the bucket.\n`);

  if (missing.length > 0) {
    // Grouped by source: one deleted project accounts for seven keys, and a
    // flat list of those seven reads like seven separate problems.
    const bySource = new Map();
    for (const { key, source } of missing) {
      if (!bySource.has(source)) bySource.set(source, []);
      bySource.get(source).push(key);
    }
    console.log(`MISSING — referenced but not in the bucket (${missing.length}):`);
    for (const [source, keys] of bySource) {
      console.log(`  ${source}`);
      for (const key of keys) console.log(`    ${key}`);
    }
    console.log("\nEither re-publish the source file, or remove the entry from the JSON.\n");
  } else {
    console.log("Nothing missing — every referenced object is in the bucket.\n");
  }

  if (orphaned.length > 0) {
    console.log(`Orphaned — in the bucket, referenced by nothing (${orphaned.length}):`);
    for (const key of orphaned) console.log(`  ${key}`);
    console.log("\nHarmless; you just pay to store them.");
  }

  process.exit(missing.length > 0 ? 1 : 0);
}

main();

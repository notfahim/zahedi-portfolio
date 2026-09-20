import { readFile, writeFile } from "node:fs/promises";
import { creditFieldsFor } from "./work-categories.mjs";

/** The four content files the publish CLIs and check-media share. */
const CONTENT_DIR = new URL("../src/content/", import.meta.url);

/**
 * @param {string} name File name inside `src/content/`, e.g. `"work.json"`.
 * @returns {Promise<any>}
 */
export async function readJson(name) {
  return JSON.parse(await readFile(new URL(name, CONTENT_DIR), "utf8"));
}

/**
 * @param {string} name File name inside `src/content/`.
 * @param {any} value Serialised with a trailing newline, so the diff stays clean.
 * @returns {Promise<void>}
 */
export async function writeJson(name, value) {
  await writeFile(new URL(name, CONTENT_DIR), `${JSON.stringify(value, null, 2)}\n`);
}

/**
 * Set a key field and its `widths` list together, dropping the list when it is
 * empty. The publish CLIs write these files themselves precisely because the
 * `widths` list is easy to forget by hand, and omitting it makes a
 * high-density screen request a size that was never uploaded.
 *
 * @param {Record<string, any>} target
 * @param {string} keyField e.g. `"thumbnailKey"`.
 * @param {string} widthsField e.g. `"thumbnailWidths"`.
 * @param {string} key
 * @param {number[]} [widths]
 * @returns {Record<string, any>} A copy; the input is untouched.
 */
function withWidths(target, keyField, widthsField, key, widths) {
  const next = { ...target, [keyField]: key };
  if (widths && widths.length > 0) next[widthsField] = widths;
  else delete next[widthsField];
  return next;
}

/**
 * @param {Record<string, any>} about Parsed `about.json`.
 * @param {Record<string, any>} fields Only the fields present are written.
 * @returns {Record<string, any>}
 */
export function applyAboutFields(about, fields) {
  let site = { ...about.site };
  for (const [keyField, widthsField] of [
    ["portraitKey", "portraitWidths"],
    ["heroImageKey", "heroImageWidths"],
  ]) {
    if (fields[keyField] !== undefined) {
      site = withWidths(site, keyField, widthsField, fields[keyField], fields[widthsField]);
    }
  }
  if (fields.reelVideoKey !== undefined) site.reelVideoKey = fields.reelVideoKey;
  return { ...about, site };
}

/**
 * Add or update one photograph. Caption, location and year are written by
 * hand, so re-publishing an image keeps whatever is already on the entry.
 *
 * @param {Record<string, any>[]} photos
 * @param {Record<string, any>} entry
 * @returns {Record<string, any>[]}
 */
export function applyPhotographyEntry(photos, entry) {
  const existing = photos.find((p) => p.slug === entry.slug);
  const merged = {
    id: entry.slug,
    slug: entry.slug,
    imageKey: entry.imageKey,
    width: entry.width,
    height: entry.height,
    ...(entry.widths && entry.widths.length > 0 ? { widths: entry.widths } : {}),
    caption: existing?.caption ?? "",
    location: existing?.location ?? "",
    year: existing?.year ?? new Date().getFullYear(),
    ...(existing?.camera ? { camera: existing.camera } : {}),
  };
  if (!existing) return [...photos, merged];
  return photos.map((p) => (p.slug === entry.slug ? merged : p));
}

/**
 * Title Case from a slug: a readable placeholder so a freshly created entry
 * does not show an empty heading before it is edited.
 *
 * @param {string} slug
 * @returns {string}
 */
function titleFromSlug(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * @param {Record<string, any>[]} work
 * @param {string} slug
 * @returns {boolean} True when no project carries this slug yet.
 */
export function wasCreated(work, slug) {
  return !work.some((entry) => entry.slug === slug);
}

/**
 * Update the project with this slug, or create it. Publishing a video for a
 * project not yet in `work.json` is the normal way to add one.
 *
 * @param {Record<string, any>[]} work
 * @param {string} slug
 * @param {Record<string, any>} fields
 * @param {{ create?: boolean, category?: string }} [options] `create: false`
 *   for the thumbnail publisher, where an unknown slug is a typo rather than a
 *   new project. `category` is the folder the video was published from: it
 *   decides both the R2 key and which credit fields the new entry gets.
 * @returns {Record<string, any>[]}
 * @throws {Error} With `create: false` and an unknown slug.
 */
export function upsertWorkEntry(work, slug, fields, { create = true, category } = {}) {
  if (wasCreated(work, slug)) {
    if (!create) {
      throw new Error(
        `No project with slug "${slug}" in work.json — add the entry first, or ` +
          `re-run with a slug that matches one of: ${work.map((e) => e.slug).join(", ") || "(none)"}`
      );
    }
    const created = {
      id: slug,
      slug,
      title: titleFromSlug(slug),
      category,
      year: new Date().getFullYear(),
      // Empty rather than absent, so a freshly published project shows the
      // same fields to fill in as every other project of its kind — and only
      // those: a documentary gets client and runtime, a music video artist
      // and director.
      ...Object.fromEntries(creditFieldsFor(category).map((field) => [field, ""])),
    };
    return [...work, applyFieldsTo(created, fields)];
  }
  return work.map((entry) => (entry.slug === slug ? applyFieldsTo(entry, fields) : entry));
}

/**
 * @param {Record<string, any>} entry
 * @param {Record<string, any>} fields
 * @returns {Record<string, any>}
 */
function applyFieldsTo(entry, fields) {
  let next = { ...entry };
  if (fields.videoKey !== undefined) next.videoKey = fields.videoKey;
  if (fields.thumbnailKey !== undefined) {
    next = withWidths(next, "thumbnailKey", "thumbnailWidths", fields.thumbnailKey, fields.thumbnailWidths);
  }
  return next;
}

/**
 * Set the featured film's poster. Publishing it is normally the first thing
 * done for a film, so an absent `film` block is created rather than treated as
 * an error — its other fields are placeholders to edit afterwards.
 *
 * @param {Record<string, any>} recognition Parsed `recognition.json`.
 * @param {{ posterKey: string, posterWidths?: number[] }} poster
 * @returns {Record<string, any>}
 */
export function applyRecognitionPoster(recognition, { posterKey, posterWidths }) {
  const site = { ...recognition.site };
  const slug = posterKey.split("/").pop().replace(/-poster$/, "");
  const placeholderTitle = titleFromSlug(slug);
  const film = site.film ?? {
    title: placeholderTitle,
    year: new Date().getFullYear(),
    posterAlt: `Poster for ${placeholderTitle}`,
  };
  site.film = withWidths(film, "posterKey", "posterWidths", posterKey, posterWidths);
  return { ...recognition, site };
}

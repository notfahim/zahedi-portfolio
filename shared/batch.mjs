/**
 * Shared by the folder publisher: which files to take, and what to call them.
 *
 * @module shared/batch
 */

export const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp", ".avif"];
export const VIDEO_EXTENSIONS = [".mov", ".mp4", ".m4v", ".avi", ".mkv"];

/**
 * Turn a filename into the slug used in R2 keys and content entries. Anything
 * outside `[a-z0-9-]` is dropped rather than escaped, so keys stay readable and
 * never need URL encoding.
 *
 * @param {string} filename
 * @returns {string} The slug, or `"untitled"` when nothing usable is left.
 */
export function slugFromFilename(filename) {
  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  const slug = withoutExtension
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "untitled";
}

/**
 * The publishable files in a folder listing, sorted so a batch publishes in a
 * predictable order.
 *
 * @param {string[]} filenames
 * @param {string} category `"work"` takes videos; anything else takes images.
 * @returns {string[]}
 */
export function selectMediaFiles(filenames, category) {
  const wanted = category === "work" ? VIDEO_EXTENSIONS : IMAGE_EXTENSIONS;
  return filenames
    .filter((name) => !name.startsWith(".") && name !== "Thumbs.db")
    .filter((name) => wanted.some((ext) => name.toLowerCase().endsWith(ext)))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

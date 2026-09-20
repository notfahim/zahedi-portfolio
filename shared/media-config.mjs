export const DERIVATIVE_WIDTHS = [640, 1280, 1920, 2560];
export const DERIVATIVE_FORMATS = ["avif", "webp"];
export const MAX_LONG_EDGE = 2560;

/**
 * The R2 key of one derivative of an image. Single source of truth for the key
 * format: the browser build (`src/lib/r2-url.ts`) and the publish CLI
 * (`scripts/publish-image.mjs`) both import this rather than re-implementing
 * the same template.
 *
 * Each image gets its own folder, because one photo is 8 objects (4 widths x 2
 * formats) and flat naming makes the bucket unreadable.
 *
 * @param {string} baseKey Extensionless base key, e.g. `"photography/dunes"`.
 * @param {number} width Derivative width in pixels.
 * @param {string} format `"avif"` or `"webp"`.
 * @returns {string} e.g. `"photography/dunes/1280.avif"`.
 */
export function buildDerivativeKey(baseKey, width, format) {
  return `${baseKey}/${width}.${format}`;
}

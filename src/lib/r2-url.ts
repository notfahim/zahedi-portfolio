import { DERIVATIVE_WIDTHS, buildDerivativeKey } from "../../shared/media-config.mjs";

/** The media base URL, without a trailing slash. */
function baseUrl(): string {
  const base = import.meta.env.PUBLIC_MEDIA_BASE_URL;
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

/**
 * The public URL of a literal R2 key, used verbatim (a video, a hover preview,
 * the press kit).
 */
export function mediaUrl(key: string): string {
  return `${baseUrl()}/${key}`;
}

/** The public URL of one derivative of an image base key. */
export function derivativeUrl(baseKey: string, width: number, format: "avif" | "webp"): string {
  return `${baseUrl()}/${buildDerivativeKey(baseKey, width, format)}`;
}

/**
 * A `srcset` over the derivative widths that exist. Pass the entry's `widths`
 * list; omitting it advertises every configured width.
 */
export function derivativeSrcSet(
  baseKey: string,
  format: "avif" | "webp",
  widths: number[] = DERIVATIVE_WIDTHS
): string {
  return widths.map((w) => `${derivativeUrl(baseKey, w, format)} ${w}w`).join(", ");
}

/**
 * The largest derivative width that actually exists, at or below `preferred`,
 * falling back to the smallest available when all of them are larger.
 *
 * `publish-image` never upscales, so a source narrower than the largest
 * configured width produces fewer derivatives and a hardcoded width like 2560
 * would name a file that was never uploaded.
 */
export function pickWidth(preferred: number, widths: number[] = DERIVATIVE_WIDTHS): number {
  const sorted = [...widths].sort((a, b) => a - b);
  const fitting = sorted.filter((w) => w <= preferred);
  return fitting.length > 0 ? fitting[fitting.length - 1] : sorted[0];
}

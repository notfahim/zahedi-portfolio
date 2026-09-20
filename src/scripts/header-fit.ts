/**
 * How large the opening title may be drawn before it runs into the nav links
 * beside it.
 *
 * The title is enlarged with a transform, so its visual width is its layout
 * width times the scale — a width the header's grid knows nothing about.
 * Without a cap the enlarged name simply overlaps the links on a narrow
 * window.
 *
 * @module header-fit
 */

/** A horizontal extent, in the same coordinate space as a client rect. */
export interface Span {
  left: number;
  right: number;
}

/**
 * The clear horizontal run through the middle of the header: from the
 * innermost edge of the links on the left to the innermost edge of those on
 * the right.
 *
 * Links are matched to a side by their own midpoint, so a stacked column
 * counts once, at its innermost edge — and a link already overlapping the
 * centre is not classified as neither side and ignored, which would report the
 * header as wide open at exactly the moment nothing fits.
 */
export function freeCentreWidth(inner: Span, links: Span[]): number {
  const centre = (inner.left + inner.right) / 2;
  let left = inner.left;
  let right = inner.right;
  for (const link of links) {
    if ((link.left + link.right) / 2 < centre) left = Math.max(left, link.right);
    else right = Math.min(right, link.left);
  }
  return Math.max(0, right - left);
}

/**
 * The largest scale the opening title may be drawn at.
 *
 * @returns Never below 1: the title's bar size is its layout size, and
 *   shrinking below that would make the settled bar smaller than the CSS asks
 *   for.
 */
export function titleScaleCap(
  inner: Span,
  links: Span[],
  titleWidth: number,
  sideGap: number
): number {
  if (titleWidth <= 0) return 1;
  const usable = freeCentreWidth(inner, links) - 2 * sideGap;
  return Math.max(1, usable / titleWidth);
}

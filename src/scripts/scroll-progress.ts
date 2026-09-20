/**
 * How far through the page the reader is, 0 to 1.
 *
 * Measured against the scrollable distance rather than the document height:
 * the last viewport of a page is always on screen, so a bar tracking
 * `scrollY / height` would stop around 90% at the bottom and never look
 * finished.
 *
 * @returns 1 for a page shorter than the screen, which cannot be scrolled.
 */
export function scrollProgress(
  scrollY: number,
  viewportHeight: number,
  documentHeight: number
): number {
  const scrollable = documentHeight - viewportHeight;
  if (scrollable <= 0) return 1;
  return Math.min(1, Math.max(0, scrollY / scrollable));
}

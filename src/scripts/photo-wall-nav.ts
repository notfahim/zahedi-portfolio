/** The scroll state of the wall's viewport. */
export interface ScrollMetrics {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}

/**
 * Browsers leave sub-pixel slack at the extremes, so an exact comparison would
 * leave an arrow enabled with nowhere left to go.
 */
const EDGE_TOLERANCE_PX = 2;

/** How far one arrow press scrolls: most of a screen, keeping some overlap. */
export function pageAmountFor(viewportWidth: number): number {
  return Math.round(viewportWidth * 0.85);
}

/** Which arrows have somewhere left to go. */
export function arrowStateFor({ scrollLeft, scrollWidth, clientWidth }: ScrollMetrics) {
  const maxScroll = scrollWidth - clientWidth;
  if (maxScroll <= EDGE_TOLERANCE_PX) {
    return { canScrollLeft: false, canScrollRight: false };
  }
  return {
    canScrollLeft: scrollLeft > EDGE_TOLERANCE_PX,
    canScrollRight: scrollLeft < maxScroll - EDGE_TOLERANCE_PX,
  };
}

/**
 * Wire up the photo wall's arrows. The wall does not move on its own, so the
 * arrows are the signal that there is more to the right.
 */
export function initPhotoWallNav(): void {
  const viewport = document.querySelector<HTMLElement>("[data-photo-wall]");
  const previous = document.querySelector<HTMLButtonElement>("[data-wall-prev]");
  const next = document.querySelector<HTMLButtonElement>("[data-wall-next]");
  if (!viewport || !previous || !next) return;

  /** Show each arrow only while it has somewhere to go. */
  function sync() {
    const { canScrollLeft, canScrollRight } = arrowStateFor(viewport!);
    previous!.hidden = !canScrollLeft;
    next!.hidden = !canScrollRight;
  }

  /** Scroll the wall one page in `direction`. */
  function page(direction: -1 | 1) {
    viewport!.scrollBy({
      left: direction * pageAmountFor(viewport!.clientWidth),
      behavior: "smooth",
    });
  }

  previous.addEventListener("click", () => page(-1));
  next.addEventListener("click", () => page(1));
  viewport.addEventListener("scroll", sync, { passive: true });
  window.addEventListener("resize", sync);
  // Tiles are sized from image aspect ratios, so the track's width is not
  // final until the images have loaded.
  window.addEventListener("load", sync);
  sync();
}

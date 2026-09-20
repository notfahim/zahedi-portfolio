/**
 * Mark an image's wrapper as loaded, so the skeleton underneath can fade out.
 * A CSS-only skeleton cannot know when the image arrived; this is the smallest
 * hook that does.
 */
export function markLoaded(image: HTMLImageElement): void {
  image.closest("[data-media]")?.classList.add("is-loaded");
}

/** Watch every media image under `root` and mark each one as it decodes. */
export function initImageLoading(root: ParentNode = document): void {
  for (const image of root.querySelectorAll<HTMLImageElement>("[data-media] img")) {
    // complete covers the common case: a cached image has already loaded
    // before this script runs, and its load event will never fire.
    if (image.complete && image.naturalWidth > 0) markLoaded(image);
    else {
      image.addEventListener("load", () => markLoaded(image), { once: true });
      // A broken image must not leave a skeleton pulsing forever.
      image.addEventListener("error", () => markLoaded(image), { once: true });
    }
  }
}

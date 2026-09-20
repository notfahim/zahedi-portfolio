/**
 * Sections and cards fade up as they come into view, and the first screen
 * fades in on load.
 *
 * @module reveal
 */

const VISIBLE_CLASS = "is-revealed";

/**
 * Reveal `[data-reveal]` elements as they enter the viewport.
 *
 * An IntersectionObserver rather than a scroll handler, so nothing runs per
 * frame for elements nobody can see. With motion turned down, or no observer
 * at all, everything is shown at once — a reveal that never fires would leave
 * a blank page.
 */
export function initReveal(): void {
  // Marks the document as ready so the first screen can fade in from CSS
  // alone. Set on the next frame so the starting state has been painted.
  requestAnimationFrame(() => document.documentElement.classList.add("is-ready"));

  const targets = document.querySelectorAll<HTMLElement>("[data-reveal]");
  if (targets.length === 0) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || typeof IntersectionObserver === "undefined") {
    for (const target of targets) target.classList.add(VISIBLE_CLASS);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add(VISIBLE_CLASS);
        // Once revealed it stays revealed: re-hiding on scroll-back makes a
        // page the reader has already seen flicker.
        observer.unobserve(entry.target);
      }
    },
    // A little before the edge, so the movement finishes as the element
    // arrives rather than starting then.
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
  );

  for (const target of targets) observer.observe(target);
}

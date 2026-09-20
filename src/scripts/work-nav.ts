import { activeSectionId, PROBE_FRACTION, type SectionBox } from "./active-section";

/**
 * Where each category group starts and stops: from its own heading to the
 * next, and the last to the end of the grid. Kept separate from the DOM read
 * so the rule can be tested.
 *
 * The first group starts at the top of the grid rather than at its own
 * heading: the probe line sits in the upper fifth of the screen and would
 * otherwise find nothing at all while the first heading is still on its way
 * up, leaving the bar unlit exactly as you arrive.
 */
export function groupBoxes(
  tops: { id: string; top: number }[],
  gridTop: number,
  gridBottom: number
): SectionBox[] {
  return tops.map((group, i) => ({
    id: group.id,
    top: i === 0 ? gridTop : group.top,
    bottom: i + 1 < tops.length ? tops[i + 1].top : gridBottom,
  }));
}

/**
 * Light the Work bar's pill for the group in view. The bar is a jump bar, not
 * a filter — `scroll.ts`'s `[data-scroll-to]` handler does the jumping, and
 * this marks which group you are actually in, under the same probe rule as the
 * site nav.
 */
export function initWorkNav(): void {
  const grid = document.querySelector<HTMLElement>("[data-work-grid]");
  const heads = [...document.querySelectorAll<HTMLElement>("[data-work-group]")];
  const links = [...document.querySelectorAll<HTMLAnchorElement>("[data-work-jump]")];
  const bar = document.querySelector<HTMLElement>(".filter-bar");
  if (!grid || heads.length === 0 || links.length === 0) return;

  /**
   * The probe has to sit below where a jump link lands its heading, or
   * clicking "Commercials" would leave "Short Films" lit: the heading comes to
   * rest just under a probe still reading the group above. The landing line is
   * the bar's lower edge (scroll-margin-top), so the probe follows it down,
   * never rising above the shared default.
   */
  function probeFraction(): number {
    const landing = bar ? bar.getBoundingClientRect().bottom : 0;
    return Math.max(PROBE_FRACTION, (landing + 24) / window.innerHeight);
  }

  let lit: string | null = null;

  /** Re-light the bar, and keep the lit pill visible on a narrow screen. */
  function update() {
    const tops = heads.map((head) => ({
      id: head.dataset.workGroup!,
      top: head.getBoundingClientRect().top + window.scrollY,
    }));
    const gridRect = grid!.getBoundingClientRect();
    const active = activeSectionId(
      groupBoxes(tops, gridRect.top + window.scrollY, gridRect.bottom + window.scrollY),
      window.scrollY,
      window.innerHeight,
      document.documentElement.scrollHeight,
      probeFraction()
    );
    if (active === lit) return;
    lit = active;
    for (const link of links) {
      link.classList.toggle("active", link.dataset.workJump === active);
      // The bar is a nav: the current group is the current page's location.
      if (link.dataset.workJump === active) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    }

    // scrollTo rather than scrollIntoView, which would be free to scroll the
    // page vertically as well.
    const current = links.find((link) => link.dataset.workJump === active);
    if (bar && current && bar.scrollWidth > bar.clientWidth) {
      bar.scrollTo({
        left: current.offsetLeft - (bar.clientWidth - current.offsetWidth) / 2,
        behavior: "smooth",
      });
    }
  }

  update();
  // A plain scroll listener rather than a Lenis subscription: Lenis moves the
  // window, so native scroll events fire either way, and this stays free of
  // the scroll engine.
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
}

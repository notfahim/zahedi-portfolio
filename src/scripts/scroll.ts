import Lenis from "lenis";
import { titleScaleCap } from "./header-fit";
import { activeSectionId } from "./active-section";
import { scrollProgress } from "./scroll-progress";

/**
 * The site's scroll engine: Lenis, the header's shrink-to-bar behaviour, the
 * nav's active state and the progress bar.
 *
 * @module scroll
 */

/** The sections the site nav highlights, in page order. */
const SECTION_IDS = ["work", "photography", "news", "about"] as const;

/**
 * Run `fn` on every kind of scroll. Both listeners are needed: Lenis's event
 * covers its own animated scrolling, the window's covers anything that moves
 * the page past it (a keyboard, the photo wall, an anchor). Resize changes the
 * same measurements, so it runs too.
 */
function onScroll(lenis: Lenis, fn: () => void): void {
  lenis.on("scroll", fn);
  window.addEventListener("scroll", fn, { passive: true });
  window.addEventListener("resize", fn);
}

/**
 * The scale of the opening title relative to its size in the bar, read from
 * the header's own CSS so desktop and narrow screens can differ.
 */
function readOpeningScale(header: HTMLElement): number {
  const raw = header.style.getPropertyValue("--title-scale");
  header.style.removeProperty("--title-scale");
  const value = parseFloat(getComputedStyle(header).getPropertyValue("--title-scale")) || 1;
  if (raw) header.style.setProperty("--title-scale", raw);
  return value;
}

/**
 * Keep the header's contents centred in the first screen until the first
 * `[data-header-push]` element below them (the Play Reel button when there is
 * one, otherwise the Work jump bar) reaches them, then move them up in step
 * with it — shrinking the title — until they sit in the top bar.
 */
function initHeaderPush(lenis: Lenis): void {
  const header = document.querySelector<HTMLElement>(".site-header");
  const inner = header?.querySelector<HTMLElement>(".header-inner");
  const pushers = [...document.querySelectorAll<HTMLElement>("[data-header-push]")];
  if (!header || !inner || pushers.length === 0) return;
  // They scroll together, so whichever is highest on the page stays first.
  const pusher = pushers.reduce((a, b) =>
    a.getBoundingClientRect().top <= b.getBoundingClientRect().top ? a : b
  );

  const GAP = 24; // px kept between the header contents and the buttons
  let openingScale = readOpeningScale(header);
  let restY = 0;
  let halfHeight = 0;
  let barHeight = 0;

  /** Re-read the sizes the push depends on: title cap, bar height, centre. */
  function measure() {
    header!.style.removeProperty("--header-y");
    openingScale = readOpeningScale(header!);

    // The opening title is drawn with a transform, so its visual width is
    // its layout width times the scale — a width the header's grid knows
    // nothing about. On a narrow window the enlarged name therefore ran
    // straight over the links beside it. Cap the scale at the clear run
    // actually left between the links.
    const title = inner!.querySelector<HTMLElement>(".title-block");
    if (title && title.offsetWidth > 0) {
      // Measure with the nav at its smallest, because that is the state the
      // cap is for: the nav grows only as the title shrinks, so the two are
      // never both large. Measuring the bar-sized nav (the CSS default)
      // overstated it by ~60% and cost the opening title a quarter of the
      // room it had.
      const held = header!.style.getPropertyValue("--nav-progress");
      header!.style.setProperty("--nav-progress", "0");
      const innerRect = inner!.getBoundingClientRect();
      // The menu button counts too: below the breakpoint it replaces the
      // links, and a title measured against links that are display:none
      // would grow straight over it.
      // Queried from the header, not the inner row: the menu button lives
      // outside that row so it can stay pinned to the bar.
      const links = [...header!.querySelectorAll<HTMLElement>(".nav-group a, [data-menu-toggle]")]
        .filter((el) => el.getBoundingClientRect().width > 0)
        .map((el) => el.getBoundingClientRect());
      if (held) header!.style.setProperty("--nav-progress", held);
      else header!.style.removeProperty("--nav-progress");

      // Breathing room either side, proportional so a phone does not spend
      // most of its header on margins.
      const sideGap = Math.min(28, inner!.clientWidth * 0.045);
      const cap = titleScaleCap(innerRect, links, title.offsetWidth, sideGap);
      openingScale = Math.max(1, Math.min(openingScale, cap));
    }
    barHeight = header!.getBoundingClientRect().height;
    // Offset that centres the contents in the viewport.
    restY = window.innerHeight / 2 - barHeight / 2;
    // Half the height the contents occupy while large.
    const natural = inner!.getBoundingClientRect().height;
    const titleHeight = title ? title.offsetHeight : natural;
    halfHeight = Math.max(natural, titleHeight * openingScale) / 2;
  }

  /** Place the header for the current scroll position. */
  function update() {
    const buttonsTop = pusher!.getBoundingClientRect().top;
    // Where the contents' centre may sit: never below mid-screen, never
    // closer than GAP to the buttons, never above the bar.
    const centre = Math.min(window.innerHeight / 2, buttonsTop - GAP - halfHeight);
    const y = Math.max(0, Math.min(restY, centre - barHeight / 2));
    const progress = restY > 0 ? 1 - y / restY : 1;
    const scale = openingScale + (1 - openingScale) * progress;
    header!.style.setProperty("--header-y", `${y}px`);
    header!.style.setProperty("--title-scale", `${scale}`);
    // The role line is legible only while the title is large; fade it out
    // over the second half of the trip rather than shrink it to a smudge.
    header!.style.setProperty("--role-opacity", `${Math.max(0, 1 - progress * 2)}`);
    // The nav runs the other way to the title: small while the name is large
    // and centred, full size once it has settled into the bar.
    header!.style.setProperty("--nav-progress", `${progress}`);
    document.documentElement.classList.toggle("header-compact", y <= 0.5);
  }

  measure();
  update();
  // The cap divides the clear run by the title's laid-out width, so it is
  // only right once the display font is in use. Measured against the
  // fallback it came out a little too generous and the opening name touched
  // the links — and differed from load to load, depending on whether the
  // font was already cached.
  document.fonts?.ready.then(() => {
    measure();
    update();
  });
  onScroll(lenis, update);
  window.addEventListener("resize", () => {
    measure();
    update();
  });
}

/** Start Lenis and everything driven off the scroll position. */
export function initScrollEngine(): void {
  const lenis = new Lenis({
    // Lenis's default easing settles slowly enough to read as lag — a wheel
    // tick kept travelling after the gesture stopped, so a second tick felt
    // like it did nothing. A higher lerp tracks the wheel closely while
    // still smoothing it.
    lerp: 0.14,
    wheelMultiplier: 1.1,
  });

  // The photo wall opts out of Lenis (data-lenis-prevent) so its horizontal
  // scroll is not hijacked. The cost: a vertical wheel there fell through to
  // the browser's own scrolling, which fights Lenis's position and made the
  // page stick until you scrolled again. Route vertical intent back into
  // Lenis by hand and leave horizontal intent to the wall.
  const wall = document.querySelector<HTMLElement>("[data-photo-wall]");
  wall?.addEventListener(
    "wheel",
    (event) => {
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      event.preventDefault();
      lenis.scrollTo(lenis.targetScroll + event.deltaY, { duration: 0.4 });
    },
    { passive: false }
  );

  // A bare rAF loop: Lenis needs a frame loop, and this is what a scroll
  // library's ticker does in four lines.
  function frame(time: number) {
    lenis.raf(time);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  initHeaderPush(lenis);

  /**
   * Highlight the nav link for the section in view. Measured per scroll rather
   * than with an observer per section: the rule needs all four sections at
   * once (see `activeSectionId`), which independent triggers cannot express.
   */
  function updateActiveNav() {
    const boxes = SECTION_IDS.flatMap((id) => {
      const section = document.getElementById(id);
      if (!section) return [];
      const rect = section.getBoundingClientRect();
      return [{ id, top: rect.top + window.scrollY, bottom: rect.bottom + window.scrollY }];
    });
    const active = activeSectionId(
      boxes,
      window.scrollY,
      window.innerHeight,
      document.documentElement.scrollHeight
    );
    for (const id of SECTION_IDS) {
      const link = document.querySelector<HTMLAnchorElement>(`[data-nav="${id}"]`);
      link?.classList.toggle("active", id === active);
    }
  }

  const progressBar = document.querySelector<HTMLElement>(".scroll-progress");

  /**
   * Fill the progress bar. Shares the nav's scroll handler rather than adding
   * its own: both need the same two measurements every frame.
   */
  function updateProgress() {
    if (!progressBar) return;
    const docHeight = document.documentElement.scrollHeight;
    const progress = scrollProgress(window.scrollY, window.innerHeight, docHeight);
    progressBar.style.setProperty("--scroll-progress", `${progress}`);
    // Hidden on a page with nothing to scroll, and while the reader is still
    // at the very top, where a full-width empty track is just a line.
    const scrollable = docHeight - window.innerHeight > 4;
    progressBar.style.setProperty("--progress-opacity", scrollable && window.scrollY > 8 ? "1" : "0");
  }

  updateActiveNav();
  updateProgress();
  onScroll(lenis, updateProgress);
  onScroll(lenis, updateActiveNav);

  // Stop Lenis while either lightbox is open. Lenis only honors
  // data-lenis-prevent, not defaultPrevented, and PhotoSwipe v5 has no
  // body-scroll lock of its own — without this, wheeling over an open
  // lightbox scrolls the page underneath it. Both lightboxes
  // dispatch overlay:open/overlay:close on document.
  document.addEventListener("overlay:open", () => lenis.stop());
  document.addEventListener("overlay:close", () => {
    // Defensive: this must run even if lenis.start() itself misbehaves, or a
    // stray exception elsewhere in a close handler would leave Lenis stopped
    // and the page permanently unscrollable.
    try {
      lenis.start();
    } catch {
      // Nothing more to do — lenis.start() is the recovery action itself.
    }
  });

  // Content above the viewport changed height (a work panel closing as it
  // scrolls out of sight). Take the difference off the scroll position in the
  // same frame, or the page appears to jump by that much. Lenis owns the
  // scroll, so the correction has to go through it rather than window.scrollTo.
  document.addEventListener("scroll:shift", (event) => {
    const delta = (event as CustomEvent<number>).detail;
    if (delta) lenis.scrollTo(lenis.targetScroll + delta, { immediate: true, force: true });
  });

  // A component asking for a smooth scroll to an absolute position (the work
  // panel centring itself as it opens). Routed through Lenis for the same
  // reason as everything else here: it owns the scroll position.
  document.addEventListener("scroll:to", (event) => {
    lenis.scrollTo((event as CustomEvent<number>).detail);
  });

  // Smooth anchor scrolling for anything marked data-scroll-to (header nav
  // links and the footer's "Back to top" link both carry it).
  document.querySelectorAll<HTMLAnchorElement>("[data-scroll-to]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetId = link.getAttribute("href");
      if (!targetId?.startsWith("#")) return;
      const target = document.querySelector(targetId);
      if (!target) return;
      event.preventDefault();
      // Lenis reads the target's scroll-margin-top itself, which is how the
      // Work group headings clear the fixed header and the sticky bar.
      lenis.scrollTo(target as HTMLElement);
    });
  });
}

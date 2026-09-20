import { buildDetails, buildVideoAttributes, type ProjectFields } from "./video-lightbox";

/**
 * One element per detail row of the expanded card.
 *
 * @param doc Taken as an argument so the row building can be tested without a
 *   live DOM.
 */
export function renderDetailRows(fields: ProjectFields, doc: Document = document) {
  const { rows } = buildDetails(fields);
  return rows.map(({ label, value }) => {
    const row = doc.createElement("div");
    row.className = label ? "detail-row" : "detail-lead";
    if (label) {
      const labelEl = doc.createElement("span");
      labelEl.className = "detail-label";
      labelEl.textContent = label;
      row.appendChild(labelEl);
    }
    const valueEl = doc.createElement("span");
    valueEl.className = "detail-value";
    valueEl.textContent = value;
    row.appendChild(valueEl);
    return row;
  });
}

/** Cards sharing a grid row share an offsetTop, give or take rounding. */
const ROW_TOLERANCE_PX = 2;

/**
 * The last card in the same grid row as `index`. The panel opens after it, so
 * the thumbnails stay where they are and only the rows below are pushed down.
 */
export function lastIndexInRowOf(tops: number[], index: number): number {
  const rowTop = tops[index];
  let last = index;
  while (last + 1 < tops.length && Math.abs(tops[last + 1] - rowTop) <= ROW_TOLERANCE_PX) {
    last += 1;
  }
  return last;
}

/**
 * Open projects in a panel beneath their own row: the thumbnail stays visible
 * and in place, and only the rows below move. Nothing covers the page, so the
 * grid stays the context rather than being replaced by a modal.
 */
export function initWorkExpand(): void {
  const grid = document.querySelector<HTMLElement>("[data-work-grid]");
  const viewer = document.querySelector<HTMLElement>("[data-work-viewer]");
  if (!grid || !viewer) return;

  // The sticky category bar covers the top of the section; the panel is
  // centred in what is left under it.
  const bar = document.querySelector<HTMLElement>(".filter-bar");
  const slot = viewer.querySelector<HTMLElement>("[data-video-slot]");
  const details = viewer.querySelector<HTMLElement>("[data-details]");
  const titleEl = viewer.querySelector<HTMLElement>("[data-viewer-title]");
  if (!slot || !details || !titleEl) return;

  let openTrigger: HTMLElement | null = null;
  /** Must outlast the CSS transition on .work-viewer; see WorkSection.astro. */
  const CLOSE_MS = 420;
  let closeTimer: number | undefined;

  /**
   * Take the panel out of the flow, once it has finished sliding shut —
   * hiding it immediately would make the close instant while the open
   * animates.
   */
  function settleClosed() {
    viewer!.hidden = true;
    slot!.replaceChildren();
  }

  /**
   * Whether the panel's video is playing fullscreen.
   *
   * Going fullscreen fires a resize and moves the video to the top layer, so
   * the panel behind it measures as off screen — both of which ask for a
   * close, which would tear the playing `<video>` out of the document and drop
   * the reader back out of fullscreen. Guarded here rather than at each
   * caller, so every route into a close is covered.
   *
   * `webkitDisplayingFullscreen` is iOS Safari, where a video goes fullscreen
   * without ever becoming `document.fullscreenElement`.
   */
  function inFullscreen(): boolean {
    const video = slot!.querySelector<
      HTMLVideoElement & { webkitDisplayingFullscreen?: boolean }
    >("video");
    return Boolean(document.fullscreenElement) || Boolean(video?.webkitDisplayingFullscreen);
  }

  /**
   * Close the open panel.
   *
   * `immediate` skips the slide shut: closing a panel that sits above the
   * viewport has to happen in one frame so the scroll can be corrected by
   * exactly the height that vanished, where animating it would slide
   * everything on screen upward for the length of the transition.
   */
  function collapse({ restoreFocus = true, immediate = false } = {}) {
    if (!openTrigger || inFullscreen()) return;
    const trigger = openTrigger;
    openTrigger = null;
    viewer!.classList.remove("is-open");
    // The sound stops now, at the start of the close; the element itself is
    // removed when the panel has finished closing. Pausing rather than
    // removing keeps the last frame on screen while the panel slides shut
    // instead of flashing an empty black box.
    slot!.querySelector("video")?.pause();
    window.clearTimeout(closeTimer);
    // A timer rather than transitionend, which never fires at all under
    // prefers-reduced-motion — the panel would stay in the flow forever.
    if (immediate) settleClosed();
    else closeTimer = window.setTimeout(settleClosed, CLOSE_MS);
    trigger.setAttribute("aria-expanded", "false");
    trigger.closest(".project-card")?.classList.remove("is-active");
    grid!.classList.remove("work-grid-open");
    if (restoreFocus) trigger.focus();
  }

  /** The cards currently rendered, in grid order. */
  function visibleCards(): HTMLElement[] {
    return [...grid!.querySelectorAll<HTMLElement>(".project-card")].filter(
      (card) => card.offsetParent !== null
    );
  }

  /** Open the panel for a card, and centre it in the space under the bar. */
  function expand(trigger: HTMLElement) {
    const card = trigger.closest<HTMLElement>(".project-card");
    const videoKey = trigger.dataset.videoKey;
    if (!card) return;

    collapse({ restoreFocus: false });
    // The close this just scheduled would otherwise fire mid-animation and
    // empty the panel that is currently opening.
    window.clearTimeout(closeTimer);
    settleClosed();

    // Measure with the panel out of the flow, or a panel already sitting in
    // an earlier row shifts the tops being compared.
    const cards = visibleCards();
    const index = cards.indexOf(card);
    if (index === -1) return;
    const tops = cards.map((c) => c.offsetTop);
    const rowLast = cards[lastIndexInRowOf(tops, index)];
    rowLast.after(viewer!);

    // A stills-only project has no video: the panel opens on its thumbnail,
    // cloned so the srcset already on the card is reused as-is.
    let video: HTMLVideoElement | null = null;
    if (videoKey) {
      const attrs = buildVideoAttributes(videoKey);
      video = document.createElement("video");
      video.src = attrs.src;
      video.controls = attrs.controls;
      video.autoplay = attrs.autoplay;
      video.playsInline = attrs.playsInline;
      video.preload = attrs.preload;
      video.setAttribute("controlsList", attrs.controlsList);
      video.addEventListener("contextmenu", (event) => event.preventDefault());
      slot!.replaceChildren(video);
    } else {
      const still = card.querySelector("picture")?.cloneNode(true) as HTMLElement | undefined;
      slot!.replaceChildren(...(still ? [still] : []));
    }

    titleEl!.textContent = trigger.dataset.projectTitle ?? "";
    details!.replaceChildren(...renderDetailRows(trigger.dataset as ProjectFields));

    viewer!.hidden = false;
    // Two frames, not one: the first is where the browser lays the panel out
    // at 0fr, and only a change made after that transitions. Adding the class
    // in the same frame as `hidden = false` just snaps it open.
    requestAnimationFrame(() => requestAnimationFrame(() => viewer!.classList.add("is-open")));
    trigger.setAttribute("aria-expanded", "true");
    card.classList.add("is-active");
    grid!.classList.add("work-grid-open");
    openTrigger = trigger;

    // A browser may refuse sound-on autoplay even inside a click; start muted
    // rather than showing a still frame that looks broken.
    video?.play().catch(() => {
      video!.muted = true;
      video!.play().catch(() => {});
    });

    // After the panel has its height — measured while it is still a
    // zero-height band, the centring has nothing to centre.
    window.setTimeout(() => {
      if (openTrigger !== trigger) return;
      const box = viewer!.getBoundingClientRect();
      // Everything above the sticky category bar is covered, so the space the
      // panel is centred in is what is left below it.
      const clearance = bar ? bar.getBoundingClientRect().bottom : 0;
      const room = window.innerHeight - clearance;
      // A panel taller than that room sits just under the bar instead, so its
      // top is never the part that gets hidden.
      const offset = clearance + Math.max(0, (room - box.height) / 2);
      // Through Lenis, not scrollIntoView: a native smooth scroll moves the
      // window behind Lenis's back and the next wheel tick jumps back to where
      // Lenis still thinks the page is.
      document.dispatchEvent(
        new CustomEvent("scroll:to", { detail: box.top + window.scrollY - offset })
      );
    }, CLOSE_MS);
  }

  grid.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-collapse]")) {
      collapse();
      return;
    }
    const trigger = target.closest<HTMLElement>("[data-project-expand]");
    if (!trigger) return;
    if (trigger === openTrigger) collapse();
    else expand(trigger);
  });

  // Scrolling the open panel off screen closes it: a project left open is a
  // tall gap in the grid and, for a video, sound from something no longer on
  // screen. Focus stays where the reader put it rather than being pulled back
  // to a card they have scrolled past.
  if (typeof IntersectionObserver !== "undefined") {
    new IntersectionObserver(() => {
      // Re-measured rather than trusted from the entry: the panel opens and
      // closes as a 0fr grid row, and a zero-height box reports as not
      // intersecting — which would close it on the very frame it opens. Being
      // off the top or bottom edge is the thing meant here.
      const box = viewer.getBoundingClientRect();
      if (box.bottom <= 0) {
        // Above the viewport: everything on screen sits below the panel, so
        // removing it pulls the whole view up by its height. Close it in one
        // frame, measure what the grid actually lost, and hand that to the
        // scroll engine to take off the scroll position — the reader stays
        // looking at the same cards.
        const before = grid!.offsetHeight;
        collapse({ restoreFocus: false, immediate: true });
        const delta = grid!.offsetHeight - before;
        if (delta !== 0) {
          document.dispatchEvent(new CustomEvent("scroll:shift", { detail: delta }));
        }
      } else if (box.top >= window.innerHeight) {
        // Below the viewport: only offscreen content moves, so let it slide.
        collapse({ restoreFocus: false });
      }
    }).observe(viewer);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && openTrigger) collapse();
  });

  // The panel is parked after a specific card, so a reflow that moves the
  // cards would strand it — but only a change of WIDTH reflows the grid. A
  // height-only resize is a phone's address bar sliding away, or the video
  // going fullscreen and coming back, and closing on those took the project
  // away from under the reader for no reason.
  let lastWidth = window.innerWidth;
  window.addEventListener("resize", () => {
    // In fullscreen the reported width is the screen's, not the page's;
    // recording it would make the return to the page look like a resize.
    if (inFullscreen()) return;
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    collapse({ restoreFocus: false });
  });
}

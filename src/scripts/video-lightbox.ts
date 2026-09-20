import { mediaUrl } from "../lib/r2-url";
import { CREDIT_LABELS, categoryLabel, creditFieldsFor } from "../lib/work-categories";

/** @module video-lightbox */

/** The attributes the lightbox's `<video>` is built with. */
export interface VideoAttributes {
  src: string;
  controls: true;
  autoplay: true;
  playsInline: true;
  preload: "auto";
  controlsList: string;
}

/**
 * The player's attributes for one video key. The video is self-hosted in R2
 * rather than embedded from a video platform, so the player is a plain
 * `<video>` built on open and discarded on close.
 */
export function buildVideoAttributes(videoKey: string): VideoAttributes {
  return {
    src: mediaUrl(videoKey),
    controls: true,
    autoplay: true,
    // Without this iOS Safari takes the video fullscreen on play, throwing
    // away the lightbox and its credits.
    playsInline: true,
    // Only reached after a click, so there is nothing to defer.
    preload: "auto",
    // Removes the download item from the browser's own player menu. A
    // deterrent: the file is still reachable at its URL, and the hotlink
    // rule, not this, is what stops other sites using it.
    controlsList: "nodownload",
  };
}

/**
 * What a card's dataset carries. One field per credit in
 * `shared/work-categories.mjs`: a card carries every one it has, and the
 * category decides which are shown.
 */
export interface ProjectFields {
  projectTitle?: string;
  projectCategory?: string;
  projectYear?: string;
  projectClient?: string;
  projectDirector?: string;
  projectProducer?: string;
  projectRuntime?: string;
  projectArtist?: string;
}

/** One row of the lightbox's credit block. */
export interface DetailRow {
  label: string;
  value: string;
}

export interface DetailOptions {
  /**
   * Projects show the whole credit block, blanks and all, so no two of the
   * same kind are credited inconsistently. The showreel is not a project — it
   * has no category and no client to leave blank — so it passes `false` and
   * shows only what it has.
   */
  showEmptyRows?: boolean;
}

/** `"client"` -> `"projectClient"`, the dataset key the card writes it under. */
function datasetKey(field: string): keyof ProjectFields {
  return `project${field.charAt(0).toUpperCase()}${field.slice(1)}` as keyof ProjectFields;
}

/**
 * The lightbox's title and credit rows for one card.
 *
 * Category and Year bracket the credits: what kind of thing this is, then who
 * made it, then when. Which credits appear between them is the category's own
 * business — a documentary has none, and shows just the two.
 */
export function buildDetails(
  f: ProjectFields,
  { showEmptyRows = true }: DetailOptions = {}
): { title: string; rows: DetailRow[] } {
  const rows: DetailRow[] = [];
  const add = (label: string, value: string | undefined) => {
    if (value || showEmptyRows) rows.push({ label, value: value ?? "" });
  };

  add("Category", categoryLabel(f.projectCategory));
  for (const field of creditFieldsFor(f.projectCategory)) {
    add(CREDIT_LABELS[field], f[datasetKey(field)]);
  }
  add("Year", f.projectYear);

  return { title: f.projectTitle ?? "", rows };
}

/** Wire every `[data-video-trigger]` to the shared video lightbox. */
export function initVideoLightbox(): void {
  const lightbox = document.querySelector<HTMLElement>("[data-video-lightbox]");
  const frameSlot = lightbox?.querySelector<HTMLElement>("[data-video-frame-slot]");
  const closeButton = lightbox?.querySelector<HTMLButtonElement>("[data-video-close]");
  const titleEl = lightbox?.querySelector<HTMLElement>("[data-video-title]");
  const detailsEl = lightbox?.querySelector<HTMLElement>("[data-video-details]");
  if (!lightbox || !frameSlot || !closeButton || !titleEl || !detailsEl) return;

  let lastFocused: HTMLElement | null = null;

  /**
   * Escape closes; Tab cycles between the close button and the player instead
   * of escaping into the page behind the overlay.
   */
  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = lightbox!.querySelectorAll<HTMLElement>("button, video");
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /** Open the lightbox on the video and credits a trigger carries. */
  function open(trigger: HTMLElement) {
    const videoKey = trigger.dataset.videoKey;
    if (!videoKey) return;

    lastFocused = trigger;

    const attrs = buildVideoAttributes(videoKey);
    const video = document.createElement("video");
    video.src = attrs.src;
    video.controls = attrs.controls;
    video.autoplay = attrs.autoplay;
    video.playsInline = attrs.playsInline;
    video.preload = attrs.preload;
    video.setAttribute("controlsList", attrs.controlsList);
    // Suppresses the browser's own "Save video as…" item. Deliberately a
    // speed bump: anyone who opens the network panel still has the URL.
    video.addEventListener("contextmenu", (event) => event.preventDefault());
    // Non-null assertions throughout: TypeScript's narrowing from the guard in
    // initVideoLightbox does not carry into nested function declarations, even
    // for `const` bindings.
    frameSlot!.replaceChildren(video);
    // The `autoplay` attribute alone is not enough: a browser may refuse
    // sound-on autoplay even inside a click handler, leaving a paused player.
    // Ask explicitly, and on refusal start muted rather than not at all —
    // the controls are visible, so the viewer can unmute.
    video.play().catch(() => {
      video.muted = true;
      video.play().catch(() => {});
    });

    const { title, rows } = buildDetails(trigger.dataset as ProjectFields, {
      showEmptyRows: false,
    });
    titleEl!.textContent = title;
    detailsEl!.replaceChildren(
      ...rows.map(({ label, value }) => {
        const row = document.createElement("div");
        row.className = label ? "detail-row" : "detail-lead";
        if (label) {
          const dt = document.createElement("span");
          dt.className = "detail-label";
          dt.textContent = label;
          row.appendChild(dt);
        }
        const dd = document.createElement("span");
        dd.className = "detail-value";
        dd.textContent = value;
        row.appendChild(dd);
        return row;
      })
    );

    lightbox!.hidden = false;
    closeButton!.focus();
    document.addEventListener("keydown", onKeydown);
    // Lenis only honors data-lenis-prevent, not defaultPrevented, and this
    // lightbox has no native scroll container of its own — so without this,
    // wheeling over the open video scrolls the page underneath it.
    document.dispatchEvent(new Event("overlay:open"));
  }

  /**
   * Close the lightbox and unmount the player. `overlay:close` fires from a
   * `finally`, because Lenis must restart even if something above throws —
   * otherwise the page is left unscrollable.
   */
  function close() {
    try {
      lightbox!.hidden = true;
      document.removeEventListener("keydown", onKeydown);
      frameSlot!.replaceChildren(); // unmounts the <video>, stopping playback
      lastFocused?.focus();
      lastFocused = null;
    } finally {
      document.dispatchEvent(new Event("overlay:close"));
    }
  }

  document.querySelectorAll<HTMLElement>("[data-video-trigger]").forEach((trigger) => {
    trigger.addEventListener("click", () => open(trigger));
  });
  closeButton.addEventListener("click", close);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) close();
  });
}

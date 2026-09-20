/**
 * The narrow-screen menu: below the breakpoint the header's two link groups
 * are replaced by a button that opens them as a full-screen panel.
 *
 * Any destination closes the panel, and so does Escape or a resize past the
 * breakpoint — which would otherwise leave the page under an overlay whose
 * button is gone.
 */
export function initMobileMenu(): void {
  const toggle = document.querySelector<HTMLButtonElement>("[data-menu-toggle]");
  const panel = document.querySelector<HTMLElement>("[data-menu-panel]");
  if (!toggle || !panel) return;

  /** Open or close the panel, moving focus with it. */
  function setOpen(open: boolean) {
    document.documentElement.classList.toggle("menu-open", open);
    toggle!.setAttribute("aria-expanded", String(open));
    toggle!.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    panel!.inert = !open;
    if (open) panel!.querySelector<HTMLElement>("a")?.focus();
    else toggle!.focus();
  }

  setOpen(false);
  toggle.addEventListener("click", () => {
    setOpen(!document.documentElement.classList.contains("menu-open"));
  });

  // Runs after the link's own smooth-scroll handler, which is fine: the panel
  // carries data-lenis-prevent rather than stopping Lenis outright. Stopping
  // it meant the link asked a halted Lenis to scroll and nothing happened.
  panel.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest("a")) setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.documentElement.classList.contains("menu-open")) {
      setOpen(false);
    }
  });

  const wide = window.matchMedia("(min-width: 42rem)");
  wide.addEventListener("change", (event) => {
    if (event.matches) setOpen(false);
  });
}

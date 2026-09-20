import PhotoSwipeLightbox from "photoswipe/lightbox";
import "photoswipe/style.css";

/** Mount PhotoSwipe over the photo wall, with the site's own caption line. */
export function initPhotoLightbox(): void {
  const lightbox = new PhotoSwipeLightbox({
    gallery: "[data-photo-wall-track]",
    children: ".photo-tile",
    pswpModule: () => import("photoswipe"),
  });

  lightbox.on("uiRegister", () => {
    lightbox.pswp?.ui?.registerElement({
      name: "custom-caption",
      order: 9,
      isButton: false,
      appendTo: "root",
      html: "",
      onInit: (el, pswp) => {
        pswp.on("change", () => {
          const currSlideElement = pswp.currSlide?.data.element as HTMLElement | undefined;
          const caption = currSlideElement?.dataset.caption ?? "";
          const location = currSlideElement?.dataset.location ?? "";
          const year = currSlideElement?.dataset.year ?? "";
          const camera = currSlideElement?.dataset.camera ?? "";
          el.textContent = [caption, [location, year].filter(Boolean).join(" | "), camera]
            .filter(Boolean)
            .join(" — ");
        });
      },
    });
  });

  // PhotoSwipe v5 has no body-scroll lock of its own, and Lenis only honors
  // data-lenis-prevent (not defaultPrevented) — without these events,
  // wheeling over an open photo scrolls the page underneath it.
  lightbox.on("beforeOpen", () => document.dispatchEvent(new Event("overlay:open")));
  lightbox.on("destroy", () => document.dispatchEvent(new Event("overlay:close")));

  lightbox.init();
}

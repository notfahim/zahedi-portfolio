import { defineConfig } from "astro/config";
import { loadEnv } from "vite";
import { checkMediaOriginMatchesCsp } from "./shared/check-media-csp.mjs";

// Fail the build, not just the browser console, when PUBLIC_MEDIA_BASE_URL and
// vercel.json's CSP have drifted apart. This file runs before Vite exposes
// import.meta.env, and process.env does not have .env's values yet either, so
// .env is loaded here the same way Vite loads it rather than skipping the
// check on every real build.
const { PUBLIC_MEDIA_BASE_URL } = loadEnv(process.env.NODE_ENV ?? "production", process.cwd(), "PUBLIC_");
checkMediaOriginMatchesCsp({ mediaBaseUrl: PUBLIC_MEDIA_BASE_URL });

export default defineConfig({
  output: "static",
  build: {
    inlineStylesheets: "auto",
  },
  vite: {
    build: {
      sourcemap: false,
    },
    // PhotoSwipe's viewer is loaded with a dynamic import (pswpModule), so
    // Vite does not see it during its first dependency scan. It discovers it
    // only when a visitor clicks a photo, re-optimises, and invalidates the
    // URL the open page is holding — the click then fails with "Failed to
    // fetch dynamically imported module" and the lightbox never opens until
    // the page is reloaded. Naming them here makes them part of the first
    // pass instead.
    optimizeDeps: {
      include: ["photoswipe", "photoswipe/lightbox"],
    },
  },
});

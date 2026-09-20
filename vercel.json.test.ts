import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("vercel.json security headers", () => {
  const config = JSON.parse(readFileSync(new URL("./vercel.json", import.meta.url), "utf-8"));
  const rule = config.headers?.[0];
  const headerMap = Object.fromEntries((rule?.headers ?? []).map((h: { key: string; value: string }) => [h.key, h.value]));

  it("applies to every route", () => {
    expect(rule.source).toBe("/(.*)");
  });

  it("sets nosniff", () => {
    expect(headerMap["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("denies framing", () => {
    expect(headerMap["X-Frame-Options"]).toBe("DENY");
  });

  it("sets a strict-origin referrer policy", () => {
    expect(headerMap["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("sets a CSP allowing the Vimeo player frame", () => {
    const csp = headerMap["Content-Security-Policy"];
    // Videos are self-hosted in R2 and played in a <video> element, so the
    // page embeds no third-party frames at all.
    expect(csp).toContain("frame-src 'none'");
    expect(csp).not.toContain("vimeo");
    expect(csp).toContain("default-src 'self'");
  });

  it("keeps 'unsafe-inline' on script-src and style-src", () => {
    // Load-bearing, not laziness: Astro inlines this project's component
    // scripts into index.html and emits scoped inline styles, and PhotoSwipe
    // sets inline styles at runtime. Stripping either would silently break the
    // scroll engine, the category filter, both lightboxes and the photo wall.
    const csp = headerMap["Content-Security-Policy"];
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("allows an external media origin for images and video", () => {
    // Domain-agnostic on purpose: the placeholder media domain gets swapped
    // for the real one later, so assert the SHAPE. Dropping the external
    // origin entirely would silently block every image and video on the site.
    const csp = headerMap["Content-Security-Policy"];
    expect(csp).toMatch(/img-src 'self' https:\/\/\S+ data:/);
    expect(csp).toMatch(/media-src 'self' https:\/\/\S+/);
  });
});

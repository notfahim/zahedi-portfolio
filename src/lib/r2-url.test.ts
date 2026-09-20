import { describe, it, expect, beforeEach, vi } from "vitest";

const BASE = "https://media.zahedishams.com";

beforeEach(() => {
  vi.stubEnv("PUBLIC_MEDIA_BASE_URL", BASE);
});

describe("mediaUrl", () => {
  it("joins the base URL and a plain key", async () => {
    const { mediaUrl } = await import("./r2-url");
    expect(mediaUrl("about/press-kit.pdf")).toBe(`${BASE}/about/press-kit.pdf`);
  });
});

describe("derivativeUrl", () => {
  it("builds a per-image folder key", async () => {
    const { derivativeUrl } = await import("./r2-url");
    expect(derivativeUrl("photography/neon-shadows-tokyo", 1280, "webp")).toBe(
      `${BASE}/photography/neon-shadows-tokyo/1280.webp`
    );
  });
});

describe("derivativeSrcSet", () => {
  it("lists every configured width for the given format", async () => {
    const { derivativeSrcSet } = await import("./r2-url");
    const srcset = derivativeSrcSet("photography/neon-shadows-tokyo", "avif");
    expect(srcset).toBe(
      [640, 1280, 1920, 2560]
        .map((w) => `${BASE}/photography/neon-shadows-tokyo/${w}.avif ${w}w`)
        .join(", ")
    );
  });

  it("lists only the given widths when a widths array is passed", async () => {
    // A sub-cap source (withoutEnlargement) only produces some of the
    // nominal widths — the srcset must not advertise widths that 404 (I5).
    const { derivativeSrcSet } = await import("./r2-url");
    const srcset = derivativeSrcSet("photography/small-photo", "webp", [640]);
    expect(srcset).toBe(`${BASE}/photography/small-photo/640.webp 640w`);
  });
});

describe("pickWidth", () => {
  it("returns the preferred width when it exists", async () => {
    const { pickWidth } = await import("./r2-url");
    expect(pickWidth(1280, [640, 1280, 1920, 2560])).toBe(1280);
  });

  it("falls back to the largest width at or below the preferred one", async () => {
    // A 1600px source yields 640/1280 only: asking for 1920 must not
    // produce a URL for a derivative that was never uploaded.
    const { pickWidth } = await import("./r2-url");
    expect(pickWidth(1920, [640, 1280])).toBe(1280);
    expect(pickWidth(2560, [640, 1280, 1920])).toBe(1920);
  });

  it("falls back to the smallest width when none is small enough", async () => {
    const { pickWidth } = await import("./r2-url");
    expect(pickWidth(320, [640, 1280])).toBe(640);
  });

  it("assumes every configured width exists when none are listed", async () => {
    const { pickWidth } = await import("./r2-url");
    expect(pickWidth(2560)).toBe(2560);
  });
});

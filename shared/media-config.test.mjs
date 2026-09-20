import { describe, it, expect } from "vitest";
import { buildDerivativeKey, DERIVATIVE_WIDTHS, DERIVATIVE_FORMATS } from "./media-config.mjs";

describe("buildDerivativeKey", () => {
  it("groups an image's sizes in a folder named for the image", () => {
    // One photo needs 8 objects (4 widths x 2 formats). Nesting them keeps
    // the bucket browsable — photography/ lists photos, not 8x that many
    // loose files.
    expect(buildDerivativeKey("photography/neon-shadows-tokyo", 1280, "webp")).toBe(
      "photography/neon-shadows-tokyo/1280.webp"
    );
  });

  it("never collides across the widths and formats actually published", () => {
    const keys = new Set();
    for (const w of DERIVATIVE_WIDTHS) {
      for (const f of DERIVATIVE_FORMATS) keys.add(buildDerivativeKey("work/a-thumb", w, f));
    }
    expect(keys.size).toBe(DERIVATIVE_WIDTHS.length * DERIVATIVE_FORMATS.length);
  });
});

import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { capToMaxLongEdge, generateDerivatives } from "./sharp-derivatives.mjs";

describe("capToMaxLongEdge", () => {
  it("caps the long edge and preserves aspect ratio", async () => {
    const source = await sharp({
      create: { width: 4000, height: 3000, channels: 3, background: { r: 10, g: 10, b: 10 } },
    })
      .jpeg()
      .toBuffer();

    const meta = await sharp(await capToMaxLongEdge(source, 2560)).metadata();
    expect(meta.width).toBe(2560);
    expect(meta.height).toBe(1920);
  });

  it("does not enlarge a source smaller than the cap", async () => {
    // Why this matters: the publish CLI records these dimensions into
    // photography.json for PhotoSwipe, so they cannot be assumed to equal the
    // cap — a small original stays small and must be reported at its own size.
    const source = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 10, g: 10, b: 10 } },
    })
      .jpeg()
      .toBuffer();

    const meta = await sharp(await capToMaxLongEdge(source, 2560)).metadata();
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(600);
  });
});

describe("generateDerivatives", () => {
  it("produces one buffer per width x format, capped at maxLongEdge", async () => {
    // Synthetic 4000x3000 source — larger than MAX_LONG_EDGE, forces the cap.
    const source = await sharp({
      create: { width: 4000, height: 3000, channels: 3, background: { r: 100, g: 100, b: 100 } },
    })
      .jpeg()
      .toBuffer();

    const { derivatives, width, height } = await generateDerivatives(source, {
      widths: [640, 1280],
      formats: ["webp"],
      maxLongEdge: 2560,
    });

    expect(width).toBe(2560);
    expect(height).toBe(1920);
    expect(derivatives).toHaveLength(2);
    for (const d of derivatives) {
      expect(d.format).toBe("webp");
      expect([640, 1280]).toContain(d.width);
      const meta = await sharp(d.buffer).metadata();
      expect(meta.width).toBe(d.width);
      expect(meta.width).toBeLessThanOrEqual(2560);
    }
  });

  it("skips widths above the capped image's actual width, keeping at least the smallest", async () => {
    // 800x600 source, well under every nominal width except 640 — the
    // srcset must not lie about 1280/1920/2560 existing.
    const source = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 50, g: 50, b: 50 } },
    })
      .jpeg()
      .toBuffer();

    const { derivatives, width, height } = await generateDerivatives(source, {
      widths: [640, 1280, 1920, 2560],
      formats: ["webp"],
      maxLongEdge: 2560,
    });

    expect(width).toBe(800);
    expect(height).toBe(600);
    expect(derivatives).toHaveLength(1);
    expect(derivatives[0].width).toBe(640);
  });
});

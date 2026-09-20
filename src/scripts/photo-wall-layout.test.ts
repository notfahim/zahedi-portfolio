import { describe, it, expect } from "vitest";
import { packColumns } from "./photo-wall-layout";

const opts = { height: 900, gap: 12, targetWidth: 380, maxPerColumn: 4 };

describe("packColumns", () => {
  it("fills the wall's full height in every column", () => {
    const aspects = [1.5, 0.8, 1.77, 0.67, 1.5, 1.0, 2.39, 0.75];
    for (const column of packColumns(aspects, opts)) {
      const used =
        column.items.reduce((sum, item) => sum + item.height, 0) + (column.items.length - 1) * opts.gap;
      // Every column is exactly as tall as the wall — that is what removes
      // the ragged gaps a fixed row-span grid left behind.
      expect(used).toBeCloseTo(opts.height, 4);
    }
  });

  it("keeps each photo's own proportions", () => {
    const aspects = [1.5, 0.8, 1.77];
    for (const column of packColumns(aspects, opts)) {
      for (const item of column.items) {
        expect(column.width / item.height).toBeCloseTo(aspects[item.index], 4);
      }
    }
  });

  it("uses every photo exactly once, in order", () => {
    const aspects = [1.5, 0.8, 1.77, 0.67, 1.5, 1.0];
    const indices = packColumns(aspects, opts).flatMap((c) => c.items.map((i) => i.index));
    expect(indices).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("stacks more photos when one alone would be too wide", () => {
    // A single 2.39:1 panorama filling 900px of height would be 2151px wide.
    const [column] = packColumns([2.39, 2.39, 2.39], opts);
    expect(column.items.length).toBeGreaterThan(1);
    expect(column.width).toBeLessThan(900);
  });

  it("never exceeds the per-column limit", () => {
    const aspects = Array.from({ length: 12 }, () => 3.5);
    for (const column of packColumns(aspects, opts)) {
      expect(column.items.length).toBeLessThanOrEqual(opts.maxPerColumn);
    }
  });

  it("handles a single photo", () => {
    const columns = packColumns([1.5], opts);
    expect(columns).toHaveLength(1);
    expect(columns[0].items[0].height).toBeCloseTo(900, 4);
  });

  it("returns nothing for no photos", () => {
    expect(packColumns([], opts)).toEqual([]);
  });
});

describe("fitColumns", () => {
  const base = { height: 700, gap: 12, viewportWidth: 1400, maxPerColumn: 4 };

  it("spreads a small set to fill the wall's width", async () => {
    // Seven photos packed tightly left a third of the wall empty. Fewer
    // photos per column makes each column wider AND adds columns, so the
    // same photos reach the right-hand edge.
    const { fitColumns } = await import("./photo-wall-layout");
    const columns = fitColumns([1.5, 0.8, 1.77, 0.67, 1.5, 1.0, 1.4], base);
    const total = columns.reduce((sum, c) => sum + c.width, 0) + (columns.length - 1) * base.gap;
    expect(total).toBeGreaterThanOrEqual(base.viewportWidth);
  });

  it("still fills each column's full height", async () => {
    const { fitColumns } = await import("./photo-wall-layout");
    for (const column of fitColumns([1.5, 0.8, 1.77, 0.67], base)) {
      const used = column.items.reduce((s, i) => s + i.height, 0) + (column.items.length - 1) * base.gap;
      expect(used).toBeCloseTo(base.height, 4);
    }
  });

  it("keeps a large set densely packed and overflowing, so it scrolls", async () => {
    const { fitColumns } = await import("./photo-wall-layout");
    const many = Array.from({ length: 40 }, (_, i) => (i % 3 === 0 ? 0.7 : 1.5));
    const columns = fitColumns(many, base);
    const total = columns.reduce((sum, c) => sum + c.width, 0) + (columns.length - 1) * base.gap;
    // It stops at the densest packing that already overflows, rather than
    // loosening further and making the wall needlessly long.
    expect(total).toBeGreaterThan(base.viewportWidth);
    expect(Math.max(...columns.map((c) => c.items.length))).toBe(base.maxPerColumn);
  });

  it("handles one photo without dividing by zero", async () => {
    const { fitColumns } = await import("./photo-wall-layout");
    expect(fitColumns([1.5], base)).toHaveLength(1);
  });
});

describe("targetWidthFor", () => {
  it("is the width at which three average frames fill the wall", async () => {
    const { targetWidthFor } = await import("./photo-wall-layout");
    // Three photos of aspect 1.4 in an 800px wall with 12px gaps: each is
    // (800 - 24) / 3 tall, so each is that times 1.4 wide.
    expect(targetWidthFor(800, 12, 4000)).toBeCloseTo(((800 - 24) / 3) * 1.4, 5);
  });

  it("grows with the wall rather than with the window", async () => {
    const { targetWidthFor } = await import("./photo-wall-layout");
    const short = targetWidthFor(600, 12, 4000);
    const tall = targetWidthFor(1000, 12, 4000);
    expect(tall).toBeGreaterThan(short);
    // Same wall, much wider window: unchanged.
    expect(targetWidthFor(800, 12, 4000)).toBe(targetWidthFor(800, 12, 3000));
  });

  it("never asks for a column wider than a narrow screen can show", async () => {
    const { targetWidthFor } = await import("./photo-wall-layout");
    expect(targetWidthFor(800, 12, 430)).toBeLessThanOrEqual(430 * 0.45);
  });

  it("packs three per column for a set of average frames", async () => {
    const { packColumns, targetWidthFor } = await import("./photo-wall-layout");
    const aspects = Array.from({ length: 9 }, () => 1.4);
    const columns = packColumns(aspects, {
      height: 800,
      gap: 12,
      targetWidth: targetWidthFor(800, 12, 4000),
      maxPerColumn: 4,
    });
    expect(columns.map((c) => c.items.length)).toEqual([3, 3, 3]);
  });
});


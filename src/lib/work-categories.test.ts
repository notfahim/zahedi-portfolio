import { describe, it, expect } from "vitest";
import {
  WORK_CATEGORIES,
  WORK_CATEGORY_IDS,
  categoryLabel,
  categoryCounts,
} from "./work-categories";

describe("WORK_CATEGORIES", () => {
  it("holds the five categories", () => {
    // In page order: the list doubles as the order the Work grid groups them.
    expect(WORK_CATEGORY_IDS).toEqual([
      "short-film",
      "commercial",
      "documentary",
      "music-video",
      "feature",
    ]);
  });

  it("gives every category both a singular and a plural name", () => {
    for (const c of WORK_CATEGORIES) {
      expect(c.singular).not.toBe("");
      expect(c.plural).not.toBe("");
    }
  });
});

describe("categoryLabel", () => {
  it("names a category in the singular", () => {
    expect(categoryLabel("music-video")).toBe("Music Video");
  });

  it("is empty for a project with no category", () => {
    expect(categoryLabel(undefined)).toBe("");
  });

  it("falls back to the raw id for an unknown category", () => {
    expect(categoryLabel("animation")).toBe("animation");
  });
});

describe("categoryCounts", () => {
  it("counts every category, including the empty ones", () => {
    const counts = categoryCounts([
      { category: "commercial" },
      { category: "commercial" },
      { category: "documentary" },
    ]);
    expect(counts).toEqual({
      commercial: 2,
      "short-film": 0,
      feature: 0,
      documentary: 1,
      "music-video": 0,
    });
  });

  it("ignores a project with no category", () => {
    const counts = categoryCounts([{}, { category: "feature" }]);
    expect(counts.feature).toBe(1);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(1);
  });

  it("ignores a category it does not know", () => {
    const counts = categoryCounts([{ category: "animation" }]);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import { groupBoxes } from "./work-nav";
import { activeSectionId } from "./active-section";

describe("groupBoxes", () => {
  it("starts at the grid, runs each group to the next heading, the last to the end", () => {
    expect(groupBoxes([{ id: "a", top: 100 }, { id: "b", top: 900 }], 60, 1600)).toEqual([
      { id: "a", top: 60, bottom: 900 },
      { id: "b", top: 900, bottom: 1600 },
    ]);
  });

  it("gives a lone group the whole grid", () => {
    expect(groupBoxes([{ id: "a", top: 100 }], 60, 1600)).toEqual([
      { id: "a", top: 60, bottom: 1600 },
    ]);
  });

  it("produces boxes the nav probe can resolve", () => {
    // The probe sits at 20% of the viewport, so at scrollY 500 it reads 620 —
    // inside the first group, not the second.
    const boxes = groupBoxes([{ id: "a", top: 100 }, { id: "b", top: 900 }], 60, 1600);
    expect(activeSectionId(boxes, 500, 600, 4000)).toBe("a");
    expect(activeSectionId(boxes, 1000, 600, 4000)).toBe("b");
  });
});

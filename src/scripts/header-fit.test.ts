import { describe, it, expect } from "vitest";
import { freeCentreWidth, titleScaleCap } from "./header-fit";

const inner = { left: 0, right: 1000 };

describe("freeCentreWidth", () => {
  it("is the whole header when there are no links", () => {
    expect(freeCentreWidth(inner, [])).toBe(1000);
  });

  it("measures between the innermost link on each side", () => {
    const links = [
      { left: 0, right: 100 },
      { left: 120, right: 200 },
      { left: 800, right: 880 },
      { left: 900, right: 1000 },
    ];
    expect(freeCentreWidth(inner, links)).toBe(600);
  });

  it("counts a stacked column of links once, at its innermost edge", () => {
    // Two links above one another on the left: same edge, not double-counted.
    const links = [
      { left: 0, right: 200 },
      { left: 0, right: 150 },
    ];
    expect(freeCentreWidth(inner, links)).toBe(800);
  });

  it("handles links on one side only", () => {
    expect(freeCentreWidth(inner, [{ left: 0, right: 300 }])).toBe(700);
  });

  it("never returns a negative width", () => {
    const links = [
      { left: 0, right: 600 },
      { left: 400, right: 1000 },
    ];
    expect(freeCentreWidth(inner, links)).toBe(0);
  });
});

describe("titleScaleCap", () => {
  it("divides the clear run, less a gap each side, by the title's layout width", () => {
    // 600 clear - 2x50 = 500, over a 200px title.
    const links = [
      { left: 0, right: 200 },
      { left: 800, right: 1000 },
    ];
    expect(titleScaleCap(inner, links, 200, 50)).toBe(2.5);
  });

  it("never caps below 1", () => {
    const links = [
      { left: 0, right: 480 },
      { left: 520, right: 1000 },
    ];
    expect(titleScaleCap(inner, links, 200, 24)).toBe(1);
  });

  it("returns 1 for a title that has not been laid out yet", () => {
    expect(titleScaleCap(inner, [], 0, 24)).toBe(1);
  });
});

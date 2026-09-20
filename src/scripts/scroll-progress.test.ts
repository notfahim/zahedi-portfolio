import { describe, it, expect } from "vitest";
import { scrollProgress } from "./scroll-progress";

describe("scrollProgress", () => {
  it("is 0 at the top", () => {
    expect(scrollProgress(0, 900, 10000)).toBe(0);
  });

  it("reaches exactly 1 at the bottom", () => {
    // The last screenful is already visible, so the bar must be full when
    // scrolling runs out — not at scrollY === documentHeight.
    expect(scrollProgress(10000 - 900, 900, 10000)).toBe(1);
  });

  it("is half way at half the scrollable distance", () => {
    expect(scrollProgress((10000 - 900) / 2, 900, 10000)).toBeCloseTo(0.5, 10);
  });

  it("is complete for a page that does not scroll", () => {
    expect(scrollProgress(0, 900, 900)).toBe(1);
    expect(scrollProgress(0, 900, 400)).toBe(1);
  });

  it("clamps rubber-band overscroll at both ends", () => {
    expect(scrollProgress(-120, 900, 10000)).toBe(0);
    expect(scrollProgress(99999, 900, 10000)).toBe(1);
  });
});

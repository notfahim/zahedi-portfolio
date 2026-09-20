import { describe, it, expect } from "vitest";
import { activeSectionId } from "./active-section";

// The real geometry measured at 1440x900, where the bug was reported: the
// photography section is taller than the viewport, so its lower half has to
// be scrolled into before the wall's bottom row is visible.
const sections = [
  { id: "work", top: 900, bottom: 8472 },
  { id: "photography", top: 8472, bottom: 9452 },
  { id: "news", top: 9452, bottom: 10374 },
  { id: "about", top: 10374, bottom: 10886 },
];
const VH = 900;
const DOC = 10886;

describe("activeSectionId", () => {
  it("keeps Photography while the photo wall is still on screen", () => {
    // The exact position where the old centre-line rule flipped to News
    // while 360px of the wall was still visible.
    expect(activeSectionId(sections, 9068, VH, DOC)).toBe("photography");
  });

  it("hands over to News once Photography has nearly scrolled away", () => {
    expect(activeSectionId(sections, 9310, VH, DOC)).toBe("news");
  });

  it("highlights nothing over the hero, above the first section", () => {
    expect(activeSectionId(sections, 0, VH, DOC)).toBe(null);
  });

  it("highlights the first section once it reaches the probe line", () => {
    expect(activeSectionId(sections, 800, VH, DOC)).toBe("work");
  });

  it("highlights the last section at the bottom of the page", () => {
    // About is shorter than the viewport, so its top never reaches a fixed
    // probe line before scrolling runs out.
    expect(activeSectionId(sections, DOC - VH, VH, DOC)).toBe("about");
  });

  it("highlights About while it fills the screen, not only at the last pixel", () => {
    // 170px short of the bottom, with About occupying most of the view. A
    // fixed probe line still reported News here.
    expect(activeSectionId(sections, DOC - VH - 170, VH, DOC)).toBe("about");
  });

  it("keeps the last section through the footer below it", () => {
    const withFooter = [...sections];
    // Document continues 400px past About's bottom.
    expect(activeSectionId(withFooter, 10759 - VH * 0.2, VH, 10759 + 400)).toBe("about");
  });

  it("resolves a shared edge to the later section", () => {
    // probe lands exactly on 9452, which is both News's top and
    // Photography's bottom.
    expect(activeSectionId(sections, 9452 - VH * 0.2, VH, DOC)).toBe("news");
  });

  it("returns null when there are no sections", () => {
    expect(activeSectionId([], 100, VH, DOC)).toBe(null);
  });
});

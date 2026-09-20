import { describe, it, expect } from "vitest";
import { pageAmountFor, arrowStateFor } from "./photo-wall-nav";

describe("pageAmountFor", () => {
  it("advances most of a screen, keeping some overlap for context", () => {
    // A full-width jump loses the eye's place; ~85% leaves a sliver of the
    // previous photos visible so the movement reads as continuous.
    expect(pageAmountFor(1000)).toBe(850);
  });
});

describe("arrowStateFor", () => {
  const wide = { scrollLeft: 0, scrollWidth: 3000, clientWidth: 1000 };

  it("hides the left arrow at the start", () => {
    expect(arrowStateFor(wide)).toMatchObject({ canScrollLeft: false, canScrollRight: true });
  });

  it("shows both arrows in the middle", () => {
    expect(arrowStateFor({ ...wide, scrollLeft: 1000 })).toEqual({
      canScrollLeft: true,
      canScrollRight: true,
    });
  });

  it("hides the right arrow at the end", () => {
    expect(arrowStateFor({ ...wide, scrollLeft: 2000 })).toMatchObject({ canScrollRight: false });
  });

  it("tolerates the sub-pixel gap browsers leave at the end", () => {
    // scrollLeft rarely lands exactly on scrollWidth - clientWidth; without a
    // tolerance the right arrow stays visible forever, pointing at nothing.
    expect(arrowStateFor({ ...wide, scrollLeft: 1999.4 })).toMatchObject({ canScrollRight: false });
  });

  it("hides both when everything already fits", () => {
    expect(arrowStateFor({ scrollLeft: 0, scrollWidth: 800, clientWidth: 1000 })).toEqual({
      canScrollLeft: false,
      canScrollRight: false,
    });
  });
});

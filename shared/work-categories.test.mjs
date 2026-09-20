import { describe, it, expect } from "vitest";
import {
  WORK_CATEGORIES,
  WORK_CATEGORY_IDS,
  WORK_FOLDERS,
  ALL_CREDIT_FIELDS,
  CREDIT_LABELS,
  creditFieldsFor,
  parseWorkFolder,
} from "./work-categories.mjs";

describe("the category list", () => {
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

  it("gives each category the credit fields it asks for", () => {
    expect(creditFieldsFor("commercial")).toEqual(["client", "director"]);
    expect(creditFieldsFor("short-film")).toEqual(["director", "producer", "runtime"]);
    expect(creditFieldsFor("feature")).toEqual(["director", "producer", "runtime"]);
    expect(creditFieldsFor("music-video")).toEqual(["artist", "director"]);
    expect(creditFieldsFor("documentary")).toEqual(["client", "runtime"]);
  });

  it("has no field for an unknown or missing category", () => {
    // The showreel has no category at all, and must not throw on the way to
    // showing its title and year.
    expect(creditFieldsFor(undefined)).toEqual([]);
    expect(creditFieldsFor("animation")).toEqual([]);
  });

  it("names every field it uses", () => {
    // A field with no label would render a blank <dt> in the viewer.
    for (const field of ALL_CREDIT_FIELDS) {
      expect(CREDIT_LABELS[field], `no label for "${field}"`).toBeTruthy();
    }
  });

  it("gives every category both a singular and a plural name", () => {
    for (const c of WORK_CATEGORIES) {
      expect(c.singular).not.toBe("");
      expect(c.plural).not.toBe("");
    }
  });
});

describe("parseWorkFolder", () => {
  it("reads the category out of a work folder", () => {
    expect(parseWorkFolder("work/commercial")).toEqual({
      prefix: "work/commercial",
      category: "commercial",
      isWork: true,
    });
  });

  it("offers one folder per category", () => {
    expect(WORK_FOLDERS).toEqual([
      "work/short-film",
      "work/commercial",
      "work/documentary",
      "work/music-video",
      "work/feature",
    ]);
    for (const folder of WORK_FOLDERS) expect(parseWorkFolder(folder)).not.toBeNull();
  });

  it("refuses a bare work folder", () => {
    // The whole point of the re-upload: a project video belongs to a
    // category, and an uncategorised entry would show no credits at all.
    expect(parseWorkFolder("work")).toBeNull();
    expect(parseWorkFolder("work/")).toBeNull();
  });

  it("refuses a category it does not know", () => {
    expect(parseWorkFolder("work/animation")).toBeNull();
    expect(parseWorkFolder("work/commercial/extra")).toBeNull();
  });

  it("passes the other folders through untouched", () => {
    for (const name of ["photography", "news", "about"]) {
      expect(parseWorkFolder(name)).toEqual({ prefix: name, category: undefined, isWork: false });
    }
  });
});

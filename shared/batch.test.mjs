import { describe, it, expect } from "vitest";
import { slugFromFilename, selectMediaFiles, IMAGE_EXTENSIONS, VIDEO_EXTENSIONS } from "./batch.mjs";

describe("slugFromFilename", () => {
  it("lowercases and hyphenates a human filename", () => {
    expect(slugFromFilename("Neon Shadows.jpg")).toBe("neon-shadows");
  });

  it("collapses spaces, underscores and repeated separators", () => {
    expect(slugFromFilename("First   Light__BnW.JPG")).toBe("first-light-bnw");
  });

  it("drops characters that do not belong in a URL", () => {
    expect(slugFromFilename("PRAN Milk — \"Shuddhotay\".mov")).toBe("pran-milk-shuddhotay");
  });

  it("keeps digits, which often carry meaning", () => {
    expect(slugFromFilename("bkash-dps-2026.mp4")).toBe("bkash-dps-2026");
  });

  it("never returns leading or trailing hyphens", () => {
    expect(slugFromFilename("  -- odd name --  .png")).toBe("odd-name");
  });

  it("falls back rather than returning an empty slug", () => {
    expect(slugFromFilename("???.jpg")).toBe("untitled");
  });
});

describe("selectMediaFiles", () => {
  const names = [
    ".DS_Store",
    "._hidden.jpg",
    "notes.txt",
    "Beta.JPG",
    "alpha.jpg",
    "clip.mov",
    "Thumbs.db",
  ];

  it("takes only images for the photography category", () => {
    expect(selectMediaFiles(names, "photography")).toEqual(["alpha.jpg", "Beta.JPG"]);
  });

  it("takes only videos for the work category", () => {
    expect(selectMediaFiles(names, "work")).toEqual(["clip.mov"]);
  });

  it("ignores dotfiles and macOS resource forks", () => {
    expect(selectMediaFiles(names, "photography")).not.toContain("._hidden.jpg");
  });

  it("sorts case-insensitively so runs are reproducible", () => {
    expect(selectMediaFiles(["b.jpg", "A.jpg"], "photography")).toEqual(["A.jpg", "b.jpg"]);
  });

  it("recognises the extensions it claims to", () => {
    for (const ext of IMAGE_EXTENSIONS) expect(selectMediaFiles([`x${ext}`], "photography")).toHaveLength(1);
    for (const ext of VIDEO_EXTENSIONS) expect(selectMediaFiles([`x${ext}`], "work")).toHaveLength(1);
  });
});

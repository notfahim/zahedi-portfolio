import { describe, it, expect } from "vitest";
import { expectedMediaKeys, missingMedia, orphanedMedia } from "./media-audit.mjs";

describe("expectedMediaKeys", () => {
  it("expands a thumbnail base key to the widths the entry declares", () => {
    const keys = expectedMediaKeys({
      work: [{ slug: "a", thumbnailKey: "work/a-thumb", thumbnailWidths: [640] }],
    }).map((e) => e.key);
    expect(keys).toEqual(["work/a-thumb/640.avif", "work/a-thumb/640.webp"]);
  });

  it("includes literal video and preview keys verbatim", () => {
    const keys = expectedMediaKeys({
      work: [{ slug: "a", videoKey: "work/a.mp4", hoverPreviewKey: "work/a-preview.mp4" }],
    }).map((e) => e.key);
    expect(keys).toEqual(["work/a.mp4", "work/a-preview.mp4"]);
  });

  it("skips fields a project has not filled in yet", () => {
    expect(expectedMediaKeys({ work: [{ slug: "a" }] })).toEqual([]);
  });

  it("covers the featured film's poster", () => {
    const keys = expectedMediaKeys({
      recognition: { site: { film: { posterKey: "news/p-poster", posterWidths: [640] } } },
    }).map((e) => e.key);
    expect(keys).toEqual(["news/p-poster/640.avif", "news/p-poster/640.webp"]);
  });

  it("says where each key came from", () => {
    const [first] = expectedMediaKeys({ work: [{ slug: "pran-milk", videoKey: "work/pran-milk.mp4" }] });
    expect(first.source).toBe('work.json "pran-milk"');
  });
});

describe("missingMedia", () => {
  it("reports a referenced key that is not in the bucket", () => {
    const expected = [
      { key: "work/a.mp4", source: "x" },
      { key: "work/b.mp4", source: "y" },
    ];
    expect(missingMedia(expected, ["work/a.mp4"])).toEqual([{ key: "work/b.mp4", source: "y" }]);
  });

  it("is empty when everything is present", () => {
    expect(missingMedia([{ key: "work/a.mp4", source: "x" }], ["work/a.mp4", "work/c.mp4"])).toEqual([]);
  });
});

describe("with a Set of bucket keys", () => {
  // listKeys returns a Set, not an array — the first run of check-media threw
  // on .filter because these took an array.
  it("accepts one for both checks", () => {
    const expected = [{ key: "work/a.mp4", source: "x" }];
    const bucket = new Set(["work/a.mp4", "work/old.mp4"]);
    expect(missingMedia(expected, bucket)).toEqual([]);
    expect(orphanedMedia(expected, bucket)).toEqual(["work/old.mp4"]);
  });
});

describe("orphanedMedia", () => {
  it("reports bucket objects nothing references", () => {
    expect(orphanedMedia([{ key: "work/a.mp4", source: "x" }], ["work/a.mp4", "work/old.mp4"])).toEqual([
      "work/old.mp4",
    ]);
  });
});

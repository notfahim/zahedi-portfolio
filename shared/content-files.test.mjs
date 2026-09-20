import { describe, it, expect } from "vitest";
import { applyAboutFields, upsertWorkEntry, applyPhotographyEntry, applyRecognitionPoster } from "./content-files.mjs";

describe("applyAboutFields", () => {
  const base = { site: { bio: "x", portraitKey: "about/portrait", portraitWidths: [640] } };

  it("sets the key and the widths that actually exist", () => {
    const out = applyAboutFields(base, { portraitKey: "about/portrait", portraitWidths: [640, 1280] });
    expect(out.site.portraitWidths).toEqual([640, 1280]);
  });

  it("removes the widths list when every width exists", () => {
    // A stale list is worse than none: it would keep the site asking for a
    // narrower image than the source can now provide.
    const out = applyAboutFields(base, { portraitKey: "about/portrait", portraitWidths: null });
    expect("portraitWidths" in out.site).toBe(false);
  });

  it("leaves unrelated fields alone", () => {
    const out = applyAboutFields(base, { portraitKey: "about/portrait", portraitWidths: null });
    expect(out.site.bio).toBe("x");
  });
});

describe("upsertWorkEntry with create: false", () => {
  const base = [{ slug: "a", title: "A", videoKey: "work/a.mp4" }];

  it("updates the entry with the matching slug", () => {
    const out = upsertWorkEntry(base, "a", { thumbnailKey: "work/a-thumb", thumbnailWidths: [640] }, { create: false });
    expect(out[0].thumbnailKey).toBe("work/a-thumb");
    expect(out[0].thumbnailWidths).toEqual([640]);
  });

  it("reports when no entry has that slug, rather than writing nothing silently", () => {
    expect(() => upsertWorkEntry(base, "missing", { thumbnailKey: "x" }, { create: false })).toThrow(/missing/);
  });
});

describe("applyPhotographyEntry", () => {
  it("appends a new photo", () => {
    const out = applyPhotographyEntry([], { slug: "a", imageKey: "photography/a", width: 1, height: 1 });
    expect(out).toHaveLength(1);
    expect(out[0].caption).toBe("");
  });

  it("replaces a re-published photo but keeps the words already written", () => {
    const existing = [{ slug: "a", imageKey: "photography/a", width: 1, height: 1,
      caption: "My title", location: "Dhaka", year: 2025 }];
    const out = applyPhotographyEntry(existing, { slug: "a", imageKey: "photography/a", width: 2, height: 2 });
    expect(out).toHaveLength(1);
    expect(out[0].width).toBe(2);
    expect(out[0].caption).toBe("My title");
    expect(out[0].location).toBe("Dhaka");
  });
});

describe("upsertWorkEntry", () => {
  it("updates an existing project", async () => {
    const { upsertWorkEntry } = await import("./content-files.mjs");
    const out = upsertWorkEntry([{ slug: "a", title: "A" }], "a", { videoKey: "work/a.mp4" });
    expect(out).toHaveLength(1);
    expect(out[0].videoKey).toBe("work/a.mp4");
    expect(out[0].title).toBe("A");
  });

  it("creates a project that is not there yet, rather than refusing", async () => {
    const { upsertWorkEntry } = await import("./content-files.mjs");
    const out = upsertWorkEntry([], "bkash-dps", { videoKey: "work/bkash-dps.mp4" });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "bkash-dps", slug: "bkash-dps", videoKey: "work/bkash-dps.mp4" });
  });

  it("gives a new project a readable placeholder title from its slug", async () => {
    const { upsertWorkEntry } = await import("./content-files.mjs");
    const [entry] = upsertWorkEntry([], "bkash-dps", {});
    expect(entry.title).toBe("Bkash Dps");
  });

  it("files a new project under the category it was published from", async () => {
    const { upsertWorkEntry } = await import("./content-files.mjs");
    const [entry] = upsertWorkEntry([], "a", {}, { category: "music-video" });
    expect(entry.category).toBe("music-video");
    expect(entry.year).toBe(new Date().getFullYear());
  });

  it("appends rather than reordering the projects already there", async () => {
    const { upsertWorkEntry } = await import("./content-files.mjs");
    const out = upsertWorkEntry([{ slug: "first", title: "First" }], "second", {});
    expect(out.map((e) => e.slug)).toEqual(["first", "second"]);
  });

  it("reports which entries it created, so the CLI can say so", async () => {
    const { wasCreated } = await import("./content-files.mjs");
    expect(wasCreated([{ slug: "a" }], "a")).toBe(false);
    expect(wasCreated([{ slug: "a" }], "b")).toBe(true);
  });
});

describe("upsertWorkEntry, creating", () => {
  it("seeds the credit fields it cannot know, so they are visible to fill in", async () => {
    const { upsertWorkEntry } = await import("./content-files.mjs");
    const [entry] = upsertWorkEntry(
      [],
      "new-spot",
      { videoKey: "work/commercial/new-spot.mp4" },
      { category: "commercial" }
    );
    expect(entry.client).toBe("");
    expect(entry.director).toBe("");
    expect(entry.producer).toBeUndefined();
    expect(entry.category).toBe("commercial");
  });

  it("seeds only the fields that category has", async () => {
    const { upsertWorkEntry } = await import("./content-files.mjs");
    const seeded = (category) => {
      const [entry] = upsertWorkEntry([], "x", {}, { category });
      return Object.keys(entry).filter((k) => entry[k] === "");
    };
    expect(seeded("commercial")).toEqual(["client", "director"]);
    expect(seeded("short-film")).toEqual(["director", "producer", "runtime"]);
    expect(seeded("feature")).toEqual(["director", "producer", "runtime"]);
    expect(seeded("music-video")).toEqual(["artist", "director"]);
    expect(seeded("documentary")).toEqual(["client", "runtime"]);
  });

  it("does not overwrite credits on a project that already exists", async () => {
    const { upsertWorkEntry } = await import("./content-files.mjs");
    const existing = [{ slug: "a", title: "A", client: "PRAN", director: "Alex" }];
    const [entry] = upsertWorkEntry(existing, "a", { videoKey: "work/a.mp4" });
    expect(entry.client).toBe("PRAN");
    expect(entry.director).toBe("Alex");
  });
});

describe("applyRecognitionPoster", () => {
  it("sets the poster key and widths on an existing film", () => {
    const next = applyRecognitionPoster(
      { site: { film: { title: "The Last Echo", year: 2025, posterKey: "news/old", posterAlt: "Poster" }, accolades: [] } },
      { posterKey: "news/pairpigeons-poster", posterWidths: [640, 1280] }
    );
    expect(next.site.film.posterKey).toBe("news/pairpigeons-poster");
    expect(next.site.film.posterWidths).toEqual([640, 1280]);
    expect(next.site.film.title).toBe("The Last Echo");
  });

  it("drops a stale widths list when every width was produced", () => {
    const next = applyRecognitionPoster(
      { site: { film: { title: "T", year: 2025, posterKey: "news/a", posterAlt: "P", posterWidths: [640] } } },
      { posterKey: "news/a", posterWidths: null }
    );
    expect(next.site.film.posterWidths).toBeUndefined();
  });

  it("creates the film block when there is none yet", () => {
    const next = applyRecognitionPoster({ site: { accolades: [] } }, {
      posterKey: "news/pairpigeons-poster",
      posterWidths: null,
    });
    expect(next.site.film.posterKey).toBe("news/pairpigeons-poster");
    expect(next.site.film.title).toBe("Pairpigeons");
    expect(next.site.film.posterAlt).toBe("Poster for Pairpigeons");
    expect(next.site.accolades).toEqual([]);
  });

  it("leaves the accolades untouched", () => {
    const next = applyRecognitionPoster(
      { site: { film: { title: "T", year: 2025, posterKey: "news/a", posterAlt: "P" }, accolades: [{ result: "win" }] } },
      { posterKey: "news/b", posterWidths: null }
    );
    expect(next.site.accolades).toEqual([{ result: "win" }]);
  });
});

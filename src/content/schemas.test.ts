import { describe, it, expect } from "vitest";
import { workEntrySchema, photographyEntrySchema, newsEntrySchema, aboutSchema } from "./schemas";
import { ALL_CREDIT_FIELDS, WORK_CATEGORY_IDS } from "../../shared/work-categories.mjs";
import { upsertWorkEntry } from "../../shared/content-files.mjs";

describe("workEntrySchema", () => {
  it("accepts a valid entry", () => {
    expect(() =>
      workEntrySchema.parse({
        slug: "nike-silent-sprint",
        title: 'NIKE — "THE SILENT SPRINT"',
        category: "commercial",
        director: "Alex Vance",
        year: 2025,
        thumbnailKey: "work/commercial/nike-silent-sprint-thumb",
        hoverPreviewKey: "work/commercial/nike-silent-sprint-preview.mp4",
        videoKey: "work/commercial/a.mp4",
      })
    ).not.toThrow();
  });

  it("rejects a thumbnailKey with a trailing extension", () => {
    // A base key gets suffixed by buildDerivativeKey (-<width>.<format>) — an
    // extension already on the key produces "…-thumb.webp-640.avif" and
    // 404s every Work-grid image while build and tests would otherwise stay
    // green.
    expect(() =>
      workEntrySchema.parse({
        slug: "x",
        title: "X",
        category: "commercial",
        director: "X",
        year: 2025,
        thumbnailKey: "work/commercial/x-thumb.webp",
        hoverPreviewKey: "work/commercial/x-preview.mp4",
        videoKey: "work/commercial/a.mp4",
      })
    ).toThrow();
  });

  it("accepts a hoverPreviewKey with an extension", () => {
    // hoverPreviewKey is a literal key used verbatim by mediaUrl(), not a
    // base key — it legitimately carries a real file extension.
    expect(() =>
      workEntrySchema.parse({
        slug: "x",
        title: "X",
        category: "commercial",
        director: "X",
        year: 2025,
        thumbnailKey: "work/x-thumb",
        hoverPreviewKey: "work/commercial/x-preview.mp4",
        videoKey: "work/commercial/a.mp4",
      })
    ).not.toThrow();
  });

  it("rejects a category that is not one of the five", () => {
    expect(() =>
      workEntrySchema.parse({
        slug: "x",
        title: "X",
        category: "interpretive-dance",
        director: "X",
        year: 2025,
        thumbnailKey: "x",
        hoverPreviewKey: "x",
        videoKey: "work/commercial/a.mp4",
      })
    ).toThrow();
  });
});

describe("photographyEntrySchema", () => {
  it("accepts a valid entry with pixel dimensions for PhotoSwipe", () => {
    expect(() =>
      photographyEntrySchema.parse({
        slug: "neon-shadows-tokyo",
        imageKey: "photography/neon-shadows-tokyo",
        width: 2560,
        height: 1707,
        caption: "Neon Shadows, Tokyo",
        location: "Shinjuku, Japan",
        year: 2024,
      })
    ).not.toThrow();
  });

  it("rejects a missing width/height", () => {
    expect(() =>
      photographyEntrySchema.parse({
        slug: "x",
        imageKey: "x",
        caption: "x",
        location: "x",
        year: 2024,
      })
    ).toThrow();
  });

  it("rejects an imageKey with a trailing extension", () => {
    expect(() =>
      photographyEntrySchema.parse({
        slug: "x",
        imageKey: "photography/x.jpg",
        width: 100,
        height: 100,
        caption: "x",
        location: "x",
        year: 2024,
      })
    ).toThrow();
  });

  it("accepts an optional widths array", () => {
    expect(() =>
      photographyEntrySchema.parse({
        slug: "x",
        imageKey: "photography/x",
        width: 800,
        height: 600,
        caption: "x",
        location: "x",
        year: 2024,
        widths: [640],
      })
    ).not.toThrow();
  });
});

describe("newsEntrySchema", () => {
  it("accepts a valid press entry", () => {
    expect(() =>
      newsEntrySchema.parse({
        type: "press",
        year: 2025,
        title: "Mastering Low Light: Zahedi Shams on 'Echoes'",
        org: "British Cinematographer Magazine",
        project: "The Last Echo",
        link: "https://example.com/article",
      })
    ).not.toThrow();
  });

  it("rejects an invalid type", () => {
    expect(() =>
      newsEntrySchema.parse({
        type: "tweet",
        year: 2025,
        title: "x",
        org: "x",
        project: "x",
      })
    ).toThrow();
  });
});

describe("aboutSchema", () => {
  it("accepts a valid about record", () => {
    expect(() =>
      aboutSchema.parse({
        bio: "Zahedi Shams is an internationally recognized Director of Photography...",
        representation: [{ label: "Commercials / Narrative", contact: "Agency Name (contact@agent.com)" }],
        directInquiryEmail: "zahedi@zahedishams.com",
        location: "Available Worldwide",
        pressKitKey: "about/press-kit.pdf",
        heroLoopKey: "work/hero-loop.mp4",
        portraitKey: "about/portrait",
        portraitAlt: "Zahedi Shams on set",
        reelVideoKey: "about/reel.mp4",
        reelTitle: "Reel 2026",
      })
    ).not.toThrow();
  });

  it("accepts an about record with the reel fields omitted", () => {
    // The hero "Play Reel" button must render nothing rather than a dead
    // button when the reel isn't configured yet.
    expect(() =>
      aboutSchema.parse({
        bio: "x",
        representation: [],
        directInquiryEmail: "zahedi@zahedishams.com",
        location: "Available Worldwide",
        pressKitKey: "about/press-kit.pdf",
        heroLoopKey: "work/hero-loop.mp4",
        portraitKey: "about/portrait",
        portraitAlt: "Zahedi Shams on set",
      })
    ).not.toThrow();
  });

  it("rejects a videoKey without the .mp4 extension", () => {
    // videoKey is a literal key used verbatim by mediaUrl. An extensionless
    // value would name an object that publish-video never creates.
    expect(() =>
      workEntrySchema.parse({
        slug: "a",
        title: "A",
        category: "commercial" as const,
        director: "D",
        year: 2025,
        thumbnailKey: "work/commercial/a-thumb",
        hoverPreviewKey: "work/commercial/a-preview.mp4",
        videoKey: "work/commercial/a",
      })
    ).toThrow();
  });

  it("rejects a social link that is not an absolute URL", () => {
    // Guards the footer against the href="#" placeholders it used to ship:
    // a relative or empty href must fail the build, not render a dead link.
    expect(() =>
      aboutSchema.parse({
        bio: "x",
        representation: [],
        directInquiryEmail: "zahedi@zahedishams.com",
        location: "Available Worldwide",
        pressKitKey: "about/press-kit.pdf",
        heroLoopKey: "work/hero-loop.mp4",
        portraitKey: "about/portrait",
        portraitAlt: "Zahedi Shams on set",
        socials: [{ label: "Instagram", url: "#" }],
      })
    ).toThrow();
  });

  it("accepts a valid social link list", () => {
    expect(() =>
      aboutSchema.parse({
        bio: "x",
        representation: [],
        directInquiryEmail: "zahedi@zahedishams.com",
        location: "Available Worldwide",
        pressKitKey: "about/press-kit.pdf",
        heroLoopKey: "work/hero-loop.mp4",
        portraitKey: "about/portrait",
        portraitAlt: "Zahedi Shams on set",
        socials: [{ label: "Instagram", url: "https://instagram.com/example" }],
      })
    ).not.toThrow();
  });
});

describe("workEntrySchema optional fields", () => {
  const base = {
    slug: "a",
    title: "A",
    category: "commercial" as const,
    director: "D",
    year: 2025,
    thumbnailKey: "work/commercial/a-thumb",
    videoKey: "work/commercial/a.mp4",
  };

  it("accepts a project carrying none of the credit fields", () => {
    // A project is published before its credits are known. Requiring any one
    // of them took the whole site down when one real entry omitted it.
    const parsed = workEntrySchema.parse({ ...base });
    expect(parsed.slug).toBe("a");
  });

  it("allows every credit field on any category, whichever one shows it", () => {
    // The schema is deliberately not per-category: re-filing a project keeps
    // the words already typed into it instead of failing the build.
    expect(() =>
      workEntrySchema.parse({
        ...base,
        category: "documentary",
        client: "PRAN-RFL Group",
        director: "Alex Vance",
        producer: "Mira Haque",
        runtime: "14 min",
        artist: "Meghdol",
      })
    ).not.toThrow();
  });

  it("knows exactly the credit fields the categories ask for", () => {
    // The schema spells these out so Astro can type project.data.client; this
    // is what stops that list drifting from shared/work-categories.mjs.
    const inSchema = Object.keys(workEntrySchema.shape).filter((k) =>
      ALL_CREDIT_FIELDS.includes(k)
    );
    expect(inSchema.sort()).toEqual([...ALL_CREDIT_FIELDS].sort());
  });

  it("accepts a project with no hover preview clip", () => {
    expect(() => workEntrySchema.parse({ ...base })).not.toThrow();
  });
});

// What publish-video writes has to be what the collection accepts — otherwise
// a successful upload leaves a work.json that stops the site building, and the
// only way to find out is to run the dev server.
describe("what the publish CLI writes", () => {
  it("produces an entry the collection accepts, for every category", () => {
    for (const category of WORK_CATEGORY_IDS) {
      const [entry] = upsertWorkEntry(
        [],
        "silent-sprint",
        {
          videoKey: `work/${category}/silent-sprint.mp4`,
          thumbnailKey: `work/${category}/silent-sprint-thumb`,
          thumbnailWidths: [640, 1280],
        },
        { category }
      );
      expect(() => workEntrySchema.parse(entry), `${category} entry`).not.toThrow();
      expect(workEntrySchema.parse(entry).category).toBe(category);
    }
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";

const BASE = "https://media.zahedishams.com";

beforeEach(() => {
  vi.stubEnv("PUBLIC_MEDIA_BASE_URL", BASE);
  vi.resetModules();
});

describe("buildVideoAttributes", () => {
  it("points at the R2 object for the given key", async () => {
    const { buildVideoAttributes } = await import("./video-lightbox");
    expect(buildVideoAttributes("work/silent-sprint.mp4").src).toBe(
      `${BASE}/work/silent-sprint.mp4`
    );
  });

  it("asks the browser not to offer a download", async () => {
    // A deterrent, not a lock — the file is still reachable directly. It
    // removes the player's own save button, which is the easy path.
    const { buildVideoAttributes } = await import("./video-lightbox");
    expect(buildVideoAttributes("work/a.mp4").controlsList).toBe("nodownload");
  });

  it("plays inline on iOS instead of hijacking the screen", async () => {
    const { buildVideoAttributes } = await import("./video-lightbox");
    expect(buildVideoAttributes("work/a.mp4").playsInline).toBe(true);
  });

  it("shows controls and starts playing", async () => {
    const { buildVideoAttributes } = await import("./video-lightbox");
    const attrs = buildVideoAttributes("work/a.mp4");
    expect(attrs.controls).toBe(true);
    expect(attrs.autoplay).toBe(true);
  });

  it("does not preload — the facade exists so nothing is fetched before a click", async () => {
    const { buildVideoAttributes } = await import("./video-lightbox");
    expect(buildVideoAttributes("work/a.mp4").preload).toBe("auto");
  });
});

describe("buildDetails", () => {
  // A card carries every credit field it has; the category decides which of
  // them the viewer shows.
  const full = {
    projectTitle: "PRAN Milk",
    projectCategory: "commercial",
    projectClient: "PRAN-RFL Group",
    projectDirector: "Alex Vance",
    projectProducer: "Mira Haque",
    projectRuntime: "14 min",
    projectArtist: "Meghdol",
    projectYear: "2026",
  };

  it("brackets a commercial's credits with its category and year", async () => {
    const { buildDetails } = await import("./video-lightbox");
    const { rows } = buildDetails(full);
    expect(rows.slice(0, 5)).toEqual([
      { label: "Category", value: "Commercial" },
      { label: "Client", value: "PRAN-RFL Group" },
      { label: "Director", value: "Alex Vance" },
      { label: "Year", value: "2026" },
    ]);
  });

  it("names each of the five categories in the singular", async () => {
    const { buildDetails } = await import("./video-lightbox");
    for (const [id, label] of [
      ["commercial", "Commercial"],
      ["short-film", "Short Film"],
      ["feature", "Feature"],
      ["documentary", "Documentary"],
      ["music-video", "Music Video"],
    ]) {
      const { rows } = buildDetails({ ...full, projectCategory: id });
      expect(rows[0].value).toBe(label);
    }
  });

  it("shows a row of the category's own block blank rather than dropping it", async () => {
    const { buildDetails } = await import("./video-lightbox");
    const { rows } = buildDetails({
      projectTitle: "Untitled",
      projectCategory: "commercial",
      projectDirector: "Alex Vance",
    });
    expect(rows).toEqual([
      { label: "Category", value: "Commercial" },
      { label: "Client", value: "" },
      { label: "Director", value: "Alex Vance" },
      { label: "Year", value: "" },
    ]);
  });

  it("gives each category the credit block it asks for, and no other", async () => {
    const { buildDetails } = await import("./video-lightbox");
    const labelsFor = (id: string) =>
      buildDetails({ ...full, projectCategory: id }).rows.map((r) => r.label);

    expect(labelsFor("commercial")).toEqual(["Category", "Client", "Director", "Year"]);
    expect(labelsFor("short-film")).toEqual(["Category", "Director", "Producer", "Run Time", "Year"]);
    expect(labelsFor("feature")).toEqual(["Category", "Director", "Producer", "Run Time", "Year"]);
    expect(labelsFor("music-video")).toEqual(["Category", "Artist", "Director", "Year"]);
    expect(labelsFor("documentary")).toEqual(["Category", "Client", "Run Time", "Year"]);
  });

  it("does not leak a field belonging to another category", async () => {
    const { buildDetails } = await import("./video-lightbox");
    // `full` has a client AND an artist on it; a music video shows only the
    // artist, a commercial only the client.
    const music = buildDetails({ ...full, projectCategory: "music-video" }).rows;
    expect(music.map((r) => r.label)).not.toContain("Client");
    expect(music.find((r) => r.label === "Artist")?.value).toBe("Meghdol");

    const ad = buildDetails({ ...full, projectCategory: "commercial" }).rows;
    expect(ad.map((r) => r.label)).not.toContain("Artist");
    expect(ad.find((r) => r.label === "Client")?.value).toBe("PRAN-RFL Group");
  });

  it("shows only what it has when asked not to print blanks — the showreel", async () => {
    const { buildDetails } = await import("./video-lightbox");
    // The reel has no category, so it has no credit block of its own.
    const { rows } = buildDetails({ projectTitle: "Reel 2026", projectYear: "2026" }, { showEmptyRows: false });
    expect(rows).toEqual([{ label: "Year", value: "2026" }]);
  });

  it("keeps a project with no fields at all from throwing", async () => {
    const { buildDetails } = await import("./video-lightbox");
    const { title, rows } = buildDetails({});
    expect(title).toBe("");
    expect(rows.every((r) => r.value === "")).toBe(true);
  });

  it("closes with the year, whatever the category", async () => {
    const { buildDetails } = await import("./video-lightbox");
    for (const id of ["commercial", "short-film", "feature", "documentary", "music-video"]) {
      const { rows } = buildDetails({ ...full, projectCategory: id });
      expect(rows[rows.length - 1].label).toBe("Year");
    }
  });

  it("returns the title separately from the rows", async () => {
    const { buildDetails } = await import("./video-lightbox");
    const { title } = buildDetails(full);
    expect(title).toBe("PRAN Milk");
  });
});

describe("buildDetails for the showreel", () => {
  it("drops the blank rows when asked, so the reel shows no empty credits", async () => {
    const { buildDetails } = await import("./video-lightbox");
    const { title, rows } = buildDetails({ projectTitle: "Reel 2026" }, { showEmptyRows: false });
    expect(title).toBe("Reel 2026");
    expect(rows).toEqual([]);
  });

  it("still shows the rows it does have", async () => {
    const { buildDetails } = await import("./video-lightbox");
    const { rows } = buildDetails(
      { projectTitle: "Reel 2026", projectYear: "2026" },
      { showEmptyRows: false }
    );
    expect(rows).toEqual([{ label: "Year", value: "2026" }]);
  });
});

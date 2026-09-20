import { describe, it, expect } from "vitest";
import { buildEncodeArgs, videoKeyFor, MAX_HEIGHT } from "./video-encode.mjs";

describe("buildEncodeArgs", () => {
  const args = buildEncodeArgs("/in/clip.mov", "/out/clip.mp4");

  it("reads the source and writes the destination", () => {
    expect(args[0]).toBe("-i");
    expect(args[1]).toBe("/in/clip.mov");
    expect(args[args.length - 1]).toBe("/out/clip.mp4");
  });

  it("encodes H.264 + AAC, the pair every browser can play", () => {
    expect(args).toContain("libx264");
    expect(args).toContain("aac");
  });

  it("moves the index to the front so playback can start before the download finishes", () => {
    // Without +faststart the index sits at the end of the file and the
    // browser must fetch the whole thing before showing a single frame.
    const i = args.indexOf("-movflags");
    expect(i).toBeGreaterThan(-1);
    expect(args[i + 1]).toBe("+faststart");
  });

  it("caps height without enlarging a smaller source", () => {
    const scale = args[args.indexOf("-vf") + 1];
    expect(scale).toContain(`${MAX_HEIGHT}`);
    // min(...) keeps a 720p source at 720p rather than upscaling it.
    expect(scale).toContain("min(");
  });

  it("forces even dimensions, which H.264 requires", () => {
    expect(args[args.indexOf("-vf") + 1]).toContain("/2)*2");
  });

  it("overwrites the temp file without prompting", () => {
    expect(args).toContain("-y");
  });
});

describe("videoKeyFor", () => {
  it("builds a literal key carrying the .mp4 extension", () => {
    expect(videoKeyFor("work", "silent-sprint")).toBe("work/silent-sprint.mp4");
  });

  it("does not double the extension when the slug already has one", () => {
    expect(videoKeyFor("work", "silent-sprint.mp4")).toBe("work/silent-sprint.mp4");
  });
});

describe("chooseStrategy", () => {
  const webReady = { codec: "h264", audioCodec: "aac", pixFmt: "yuv420p", height: 1080 };

  it("remuxes a source that is already web-ready", async () => {
    // Re-encoding an existing 1080p H.264 delivery file wastes time, loses a
    // generation of quality, and — as happened with a 46 MB source becoming
    // 69 MB — can produce a BIGGER file than the original.
    const { chooseStrategy } = await import("./video-encode.mjs");
    expect(chooseStrategy(webReady).action).toBe("remux");
  });

  it("re-encodes footage taller than the cap", async () => {
    const { chooseStrategy } = await import("./video-encode.mjs");
    expect(chooseStrategy({ ...webReady, height: 2160 }).action).toBe("encode");
  });

  it("re-encodes a codec browsers cannot play", async () => {
    const { chooseStrategy } = await import("./video-encode.mjs");
    expect(chooseStrategy({ ...webReady, codec: "prores" }).action).toBe("encode");
  });

  it("re-encodes 10-bit or 4:2:2 footage", async () => {
    // Browsers decode 4:2:0 8-bit reliably and little else.
    const { chooseStrategy } = await import("./video-encode.mjs");
    expect(chooseStrategy({ ...webReady, pixFmt: "yuv422p10le" }).action).toBe("encode");
  });

  it("re-encodes when the audio codec is not browser-safe", async () => {
    const { chooseStrategy } = await import("./video-encode.mjs");
    expect(chooseStrategy({ ...webReady, audioCodec: "pcm_s16le" }).action).toBe("encode");
  });

  it("remuxes a silent web-ready file", async () => {
    const { chooseStrategy } = await import("./video-encode.mjs");
    expect(chooseStrategy({ ...webReady, audioCodec: null }).action).toBe("remux");
  });

  it("explains its reasoning for the terminal", async () => {
    const { chooseStrategy } = await import("./video-encode.mjs");
    expect(chooseStrategy({ ...webReady, height: 2160 }).reason).toMatch(/1080|height|tall/i);
  });
});

describe("buildRemuxArgs", () => {
  it("copies both streams and moves the index to the front", async () => {
    const { buildRemuxArgs } = await import("./video-encode.mjs");
    const args = buildRemuxArgs("/in.mp4", "/out.mp4");
    expect(args).toContain("copy");
    expect(args[args.indexOf("-movflags") + 1]).toBe("+faststart");
    expect(args).not.toContain("libx264");
  });
});

describe("buildPosterArgs", () => {
  it("grabs a single frame at the given time", async () => {
    const { buildPosterArgs } = await import("./video-encode.mjs");
    const args = buildPosterArgs("/in.mp4", "/out.png", 12.5);
    // -ss before -i seeks by keyframe, which is fast even in a long file.
    expect(args.indexOf("-ss")).toBeLessThan(args.indexOf("-i"));
    expect(args[args.indexOf("-ss") + 1]).toBe("12.5");
    expect(args[args.indexOf("-frames:v") + 1]).toBe("1");
  });
});

describe("posterTimeFor", () => {
  it("takes a frame a third of the way in, past titles and fades", async () => {
    const { posterTimeFor } = await import("./video-encode.mjs");
    expect(posterTimeFor(90)).toBe(30);
  });

  it("does not seek past the end of a very short clip", async () => {
    const { posterTimeFor } = await import("./video-encode.mjs");
    expect(posterTimeFor(1)).toBeLessThan(1);
  });

  it("handles an unknown duration without producing NaN", async () => {
    const { posterTimeFor } = await import("./video-encode.mjs");
    expect(posterTimeFor(0)).toBe(0);
  });
});

describe("buildEncodeArgs with a bitrate ceiling", () => {
  it("constrains the encode when the source bitrate is known", async () => {
    // CRF alone targets a quality, not a size: a heavily-compressed 4K source
    // re-encoded to 1080p at CRF 21 came back BIGGER than the original
    // (46 MB in, 66 MB out). A ceiling below the source rate makes that
    // impossible.
    const { buildEncodeArgs } = await import("./video-encode.mjs");
    const args = buildEncodeArgs("/in.mov", "/out.mp4", { maxrateKbps: 2500 });
    expect(args[args.indexOf("-maxrate") + 1]).toBe("2500k");
    expect(args[args.indexOf("-bufsize") + 1]).toBe("5000k");
  });

  it("omits the ceiling when the source bitrate is unknown", async () => {
    const { buildEncodeArgs } = await import("./video-encode.mjs");
    expect(buildEncodeArgs("/in.mov", "/out.mp4")).not.toContain("-maxrate");
  });
});

describe("ceilingKbpsFor", () => {
  it("sits below the source rate so the result cannot grow", async () => {
    const { ceilingKbpsFor } = await import("./video-encode.mjs");
    expect(ceilingKbpsFor(2800)).toBeLessThan(2800);
  });

  it("does not starve a tiny source into mush", async () => {
    // A 400 kbps source is already poor; clamping to 90% of it would make a
    // visibly worse file for no useful saving.
    const { ceilingKbpsFor } = await import("./video-encode.mjs");
    expect(ceilingKbpsFor(400)).toBeGreaterThanOrEqual(400);
  });

  it("returns null for an unknown rate", async () => {
    const { ceilingKbpsFor } = await import("./video-encode.mjs");
    expect(ceilingKbpsFor(0)).toBeNull();
  });
});

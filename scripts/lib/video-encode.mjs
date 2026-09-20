/**
 * Single-rendition web encode. Every viewer receives this one file — no
 * quality ladder, no adaptive switching, a deliberate trade for not running a
 * streaming service.
 *
 * @module scripts/lib/video-encode
 */

/**
 * Height cap. The most demanding screen this site targets is a desktop
 * lightbox at 64rem, so a taller master buys file size, not visible detail.
 */
export const MAX_HEIGHT = 1080;

/**
 * Constant Rate Factor: lower is better quality and a bigger file. 21 is
 * visually clean for graded footage while cutting camera masters by roughly an
 * order of magnitude.
 */
export const CRF = 21;

export const AUDIO_BITRATE = "128k";

/**
 * Below this a file is already so compressed that shaving more off it costs
 * visible quality for a trivial saving.
 */
export const MIN_CEILING_KBPS = 1200;

/**
 * A bitrate ceiling under the source's own, so a re-encode can never produce a
 * bigger file than it started with.
 *
 * @param {number | undefined} sourceKbps
 * @returns {number | null} `null` when the container records no bitrate.
 */
export function ceilingKbpsFor(sourceKbps) {
  if (!sourceKbps || !Number.isFinite(sourceKbps) || sourceKbps <= 0) return null;
  return Math.max(Math.round(sourceKbps * 0.9), MIN_CEILING_KBPS);
}

/**
 * ffmpeg arguments for a full re-encode.
 *
 * @param {string} sourcePath
 * @param {string} outputPath
 * @param {{ maxrateKbps?: number }} [options]
 * @returns {string[]}
 */
export function buildEncodeArgs(sourcePath, outputPath, { maxrateKbps } = {}) {
  const ceiling = maxrateKbps
    ? // bufsize at 2x maxrate is the usual pairing: it lets the encoder spend
      // freely on a hard shot while holding the average under the ceiling.
      ["-maxrate", `${maxrateKbps}k`, "-bufsize", `${maxrateKbps * 2}k`]
    : [];
  return [
    "-i",
    sourcePath,
    // Cap the height, never enlarge (min()), and round to even numbers —
    // H.264 cannot encode odd dimensions with 4:2:0 chroma.
    "-vf",
    `scale=trunc(iw*min(1\\,${MAX_HEIGHT}/ih)/2)*2:trunc(min(ih\\,${MAX_HEIGHT})/2)*2`,
    "-c:v",
    "libx264",
    "-profile:v",
    "high",
    // 4:2:0 — the only chroma layout browsers decode reliably. Camera files
    // are often 4:2:2 or 10-bit, which Safari and Chrome refuse to play.
    "-pix_fmt",
    "yuv420p",
    "-preset",
    "slow",
    "-crf",
    String(CRF),
    ...ceiling,
    "-c:a",
    "aac",
    "-b:a",
    AUDIO_BITRATE,
    "-movflags",
    "+faststart",
    "-y",
    outputPath,
  ];
}

/**
 * @param {string} category R2 folder, e.g. `"work/commercial"`.
 * @param {string} slug
 * @returns {string} The `.mp4` key the encode is uploaded under.
 */
export function videoKeyFor(category, slug) {
  const base = slug.replace(/\.[a-z0-9]{2,5}$/i, "");
  return `${category}/${base}.mp4`;
}

/** Codecs and layouts every current browser decodes. */
const WEB_VIDEO_CODECS = new Set(["h264"]);
const WEB_AUDIO_CODECS = new Set(["aac", "mp3"]);
const WEB_PIX_FMTS = new Set(["yuv420p", "yuvj420p"]);

/**
 * Decide whether a source needs a full re-encode or merely a container
 * rewrite. Re-encoding an already web-ready delivery file is pure loss: it
 * costs minutes, drops a generation of quality, and can produce a bigger file
 * than the source when that source was compressed harder than our CRF.
 *
 * @param {{ codec: string, audioCodec: string | null, pixFmt: string, height: number }} probe
 * @returns {{ action: "encode" | "remux", reason: string }}
 */
export function chooseStrategy({ codec, audioCodec, pixFmt, height }) {
  if (!WEB_VIDEO_CODECS.has(codec)) {
    return { action: "encode", reason: `video codec is ${codec}, which browsers cannot play` };
  }
  if (!WEB_PIX_FMTS.has(pixFmt)) {
    return { action: "encode", reason: `pixel format is ${pixFmt}, not 8-bit 4:2:0` };
  }
  if (height > MAX_HEIGHT) {
    return { action: "encode", reason: `height is ${height}px, taller than the ${MAX_HEIGHT}px cap` };
  }
  // A silent file is fine; only an unplayable audio codec forces an encode.
  if (audioCodec && !WEB_AUDIO_CODECS.has(audioCodec)) {
    return { action: "encode", reason: `audio codec is ${audioCodec}, which browsers cannot play` };
  }
  return { action: "remux", reason: "already web-ready — copying streams without re-encoding" };
}

/**
 * ffmpeg arguments for a container rewrite: same bytes, index moved to the
 * front. Near-instant and lossless.
 *
 * @param {string} sourcePath
 * @param {string} outputPath
 * @returns {string[]}
 */
export function buildRemuxArgs(sourcePath, outputPath) {
  return ["-i", sourcePath, "-c", "copy", "-movflags", "+faststart", "-y", outputPath];
}

/**
 * @param {string} sourcePath
 * @returns {string[]} ffprobe arguments producing the JSON `parseProbe` reads.
 */
export function buildProbeArgs(sourcePath) {
  return [
    "-v", "error",
    "-show_entries", "stream=codec_type,codec_name,height,pix_fmt",
    "-show_entries", "format=duration,bit_rate",
    "-of", "json",
    sourcePath,
  ];
}

/**
 * @param {string | object} json ffprobe output.
 * @returns {{ codec: string, pixFmt: string, height: number, audioCodec: string | null, duration: number, bitrateKbps: number }}
 *   `bitrateKbps` is 0 when the container does not record it.
 * @throws {Error} When the file has no video stream.
 */
export function parseProbe(json) {
  const data = typeof json === "string" ? JSON.parse(json) : json;
  const streams = data.streams ?? [];
  const video = streams.find((s) => s.codec_type === "video");
  const audio = streams.find((s) => s.codec_type === "audio");
  if (!video) throw new Error("no video stream found in that file");
  return {
    codec: video.codec_name,
    pixFmt: video.pix_fmt,
    height: Number(video.height),
    audioCodec: audio ? audio.codec_name : null,
    duration: Number(data.format?.duration ?? 0),
    bitrateKbps: Math.round(Number(data.format?.bit_rate ?? 0) / 1000),
  };
}

/**
 * Where to grab the poster frame: a third of the way in, past opening titles
 * and any fade from black, usually still inside the opening scene.
 *
 * @param {number | undefined} durationSeconds
 * @returns {number} Seconds.
 */
export function posterTimeFor(durationSeconds) {
  if (!durationSeconds || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
  return Math.min(durationSeconds / 3, Math.max(0, durationSeconds - 0.1));
}

/**
 * @param {string} sourcePath
 * @param {string} outputPath
 * @param {number} atSeconds
 * @returns {string[]} ffmpeg arguments writing one still.
 */
export function buildPosterArgs(sourcePath, outputPath, atSeconds) {
  return [
    // -ss ahead of -i seeks by keyframe before decoding, so this is fast even
    // on a long file.
    "-ss",
    String(atSeconds),
    "-i",
    sourcePath,
    "-frames:v",
    "1",
    // Tells the image2 muxer this is one still, not a numbered sequence.
    // Without it ffmpeg prints a confusing "does not contain an image
    // sequence pattern" warning even though the frame is written correctly.
    "-update",
    "1",
    "-q:v",
    "2",
    "-y",
    outputPath,
  ];
}

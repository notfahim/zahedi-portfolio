import { DERIVATIVE_WIDTHS, DERIVATIVE_FORMATS, buildDerivativeKey } from "./media-config.mjs";

/**
 * @param {string} baseKey
 * @param {number[]} [widths] Defaults to every configured width.
 * @returns {string[]} One key per width x format.
 */
function derivativesOf(baseKey, widths) {
  const list = widths && widths.length > 0 ? widths : DERIVATIVE_WIDTHS;
  return list.flatMap((width) =>
    DERIVATIVE_FORMATS.map((format) => buildDerivativeKey(baseKey, width, format))
  );
}

/**
 * @param {{ key: string, source: string }[]} into
 * @param {Iterable<string>} keys
 * @param {string} source Content file the keys came from, for the report.
 */
function add(into, keys, source) {
  for (const key of keys) into.push({ key, source });
}

/**
 * Every R2 object the content files say exists, so it can be checked against
 * what the bucket actually holds. Content and bucket drift apart silently:
 * clearing a bucket folder leaves the JSON entry behind and the site shows a
 * broken image with nothing in the build to say why.
 *
 * @param {{ work?: any[], photography?: any[], about?: any, recognition?: any }} [content]
 * @returns {{ key: string, source: string }[]}
 */
export function expectedMediaKeys({ work = [], photography = [], about, recognition } = {}) {
  const expected = [];

  for (const entry of work) {
    const where = `work.json "${entry.slug}"`;
    if (entry.videoKey) add(expected, [entry.videoKey], where);
    if (entry.hoverPreviewKey) add(expected, [entry.hoverPreviewKey], where);
    if (entry.thumbnailKey) {
      add(expected, derivativesOf(entry.thumbnailKey, entry.thumbnailWidths), where);
    }
  }

  for (const photo of photography) {
    add(expected, derivativesOf(photo.imageKey, photo.widths), `photography.json "${photo.slug}"`);
  }

  const site = about?.site;
  if (site) {
    if (site.portraitKey) add(expected, derivativesOf(site.portraitKey, site.portraitWidths), "about.json");
    if (site.heroImageKey) add(expected, derivativesOf(site.heroImageKey, site.heroImageWidths), "about.json");
    if (site.heroLoopKey) add(expected, [site.heroLoopKey], "about.json");
    if (site.reelVideoKey) add(expected, [site.reelVideoKey], "about.json");
    if (site.quotationKey) add(expected, [site.quotationKey], "about.json");
  }

  const film = recognition?.site?.film;
  if (film?.posterKey) {
    add(expected, derivativesOf(film.posterKey, film.posterWidths), "recognition.json film");
  }

  return expected;
}

/**
 * Keys the content references but the bucket does not hold: each one is a
 * broken image, a dead video, or a 404 on the press kit.
 *
 * @param {{ key: string, source: string }[]} expected
 * @param {Iterable<string>} bucketKeys Any iterable — `listKeys` returns a Set.
 * @returns {{ key: string, source: string }[]}
 */
export function missingMedia(expected, bucketKeys) {
  const present = new Set(bucketKeys);
  return expected.filter(({ key }) => !present.has(key));
}

/**
 * Keys in the bucket that nothing references. Not an error — you pay for the
 * storage, that is all.
 *
 * @param {{ key: string, source: string }[]} expected
 * @param {Iterable<string>} bucketKeys Any iterable — `listKeys` returns a Set.
 * @returns {string[]}
 */
export function orphanedMedia(expected, bucketKeys) {
  const referenced = new Set(expected.map((e) => e.key));
  return [...bucketKeys].filter((key) => !referenced.has(key));
}

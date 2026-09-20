import sharp from "sharp";

/**
 * Resize an image to fit inside a square of `maxLongEdge`, never enlarging.
 *
 * Exported so the publish CLI can measure exactly the capped image it uploads:
 * the dimensions recorded in `photography.json` become PhotoSwipe's
 * `data-pswp-width/height`, so recording the source's own dimensions would
 * claim a 6000px image exists where only a 2560px one does, and PhotoSwipe
 * would upscale a soft image to fill the claimed size.
 *
 * @param {string | Buffer} input Path or buffer.
 * @param {number} maxLongEdge
 * @returns {Promise<Buffer>}
 */
export async function capToMaxLongEdge(input, maxLongEdge) {
  return sharp(input)
    .resize({ width: maxLongEdge, height: maxLongEdge, fit: "inside", withoutEnlargement: true })
    .toBuffer();
}

/**
 * Every derivative of one image, plus the capped source's real dimensions.
 *
 * Widths above the capped image's own width are skipped: `withoutEnlargement`
 * would produce a byte-identical file advertised under a false, larger width
 * descriptor. The smallest requested width is always kept, so a source
 * narrower than every configured width still produces a non-empty set.
 *
 * @param {string | Buffer} input
 * @param {{ widths: number[], formats: string[], maxLongEdge: number }} options
 * @returns {Promise<{ derivatives: { width: number, format: string, buffer: Buffer }[], width: number, height: number }>}
 */
export async function generateDerivatives(input, { widths, formats, maxLongEdge }) {
  const cappedBuffer = await capToMaxLongEdge(input, maxLongEdge);
  const { width: cappedWidth, height: cappedHeight } = await sharp(cappedBuffer).metadata();

  const usableWidths = widths.filter((w) => w <= cappedWidth);
  const producedWidths = usableWidths.length > 0 ? usableWidths : [widths[0]];

  const derivatives = [];
  for (const width of producedWidths) {
    for (const format of formats) {
      const buffer = await sharp(cappedBuffer)
        .resize({ width, withoutEnlargement: true })
        .toFormat(format)
        .toBuffer();
      derivatives.push({ width, format, buffer });
    }
  }
  return { derivatives, width: cappedWidth, height: cappedHeight };
}

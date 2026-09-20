/** @module photo-wall-layout */

/** Inputs to one packing pass. */
export interface PackOptions {
  height: number;
  gap: number;
  targetWidth: number;
  maxPerColumn: number;
}

/** One column of the wall: its width, and the tiles stacked in it. */
export interface PackedColumn {
  width: number;
  items: { index: number; height: number }[];
}

/**
 * Pack photos into justified columns, each exactly as tall as the wall: given
 * a column width W, a photo of aspect r is W/r tall, so W is chosen to make
 * the stack plus its gaps come to the wall's height. The photos are resized to
 * fit rather than dropped into fixed slots, which is what removes the ragged
 * gaps a fixed row-span grid leaves behind.
 *
 * @param aspects Width/height per photo, in wall order.
 */
export function packColumns(aspects: number[], options: PackOptions): PackedColumn[] {
  const { height, gap, targetWidth, maxPerColumn } = options;
  const columns: PackedColumn[] = [];

  let index = 0;
  while (index < aspects.length) {
    const group: number[] = [];
    let width = 0;

    // One tall photo makes a narrow column, one panorama a very wide one, so
    // panoramas end up stacked together.
    while (index + group.length < aspects.length && group.length < maxPerColumn) {
      group.push(index + group.length);
      width = widthFor(group, aspects, height, gap);
      if (width <= targetWidth) break;
    }

    columns.push({
      width,
      items: group.map((i) => ({ index: i, height: width / aspects[i] })),
    });
    index += group.length;
  }

  return columns;
}

/** The width at which this stack of photos comes to exactly `height`. */
function widthFor(group: number[], aspects: number[], height: number, gap: number): number {
  const available = height - (group.length - 1) * gap;
  const inverseSum = group.reduce((sum, i) => sum + 1 / aspects[i], 0);
  return available / inverseSum;
}

/** Inputs to the fill-the-viewport search. */
export interface FitOptions {
  height: number;
  gap: number;
  viewportWidth: number;
  maxPerColumn: number;
}

/**
 * Pack so the columns reach the right-hand edge.
 *
 * Packing tightly can leave a small set of photos occupying only part of the
 * wall, with dead space beside it. Fewer photos per column makes every column
 * wider and adds columns, so the same photos reach the edge: this tries
 * progressively looser packings and takes the first that fills, or the loosest
 * if none does.
 */
export function fitColumns(aspects: number[], options: FitOptions): PackedColumn[] {
  const { height, gap, viewportWidth, maxPerColumn } = options;
  let best: PackedColumn[] = [];

  for (let perColumn = maxPerColumn; perColumn >= 1; perColumn -= 1) {
    const columns = packColumns(aspects, {
      height,
      gap,
      // 0 forces each column to take its cap rather than stopping early at a
      // "wide enough" width.
      targetWidth: 0,
      maxPerColumn: perColumn,
    });
    best = columns;
    const total =
      columns.reduce((sum, column) => sum + column.width, 0) + (columns.length - 1) * gap;
    if (total >= viewportWidth) return columns;
  }

  return best;
}

/** How many photographs a column should hold. */
export const TARGET_ROWS = 3;

/**
 * A typical frame's aspect. Only a nominal — the packer measures the real
 * photographs; this says what width "three deep" comes to for a mixed set, so
 * tall and wide frames fall either side of it.
 */
const NOMINAL_ASPECT = 1.4;

/**
 * The column width to aim for.
 *
 * Derived from the wall's height rather than the viewport's width, because
 * what a column width really decides is how many photographs stack in it: a
 * photo of aspect r is W/r tall, so the width that makes three of them fill
 * the wall is fixed by the height. Taking a share of the viewport width made
 * the rows-per-column vary with the window — three at 1440x900, two at
 * 1920x1080, four on a portrait screen.
 *
 * Still capped against the viewport, so a narrow phone does not end up with
 * one column wider than its screen.
 */
export function targetWidthFor(height: number, gap: number, viewportWidth: number): number {
  const threeDeep = (height - (TARGET_ROWS - 1) * gap) / (TARGET_ROWS / NOMINAL_ASPECT);
  return Math.min(threeDeep, viewportWidth * 0.45);
}

/** Lay the photo wall out, and re-lay it whenever its height can change. */
export function initPhotoWallLayout(): void {
  const viewport = document.querySelector<HTMLElement>("[data-photo-wall]");
  const track = document.querySelector<HTMLElement>("[data-photo-wall-track]");
  if (!viewport || !track) return;

  // Captured once: after the first pass the tiles live inside column
  // wrappers, so re-reading the track's children would nest them further.
  const tiles = [...track.querySelectorAll<HTMLElement>(".photo-tile")];
  const aspects = tiles.map((tile) => {
    const width = Number(tile.dataset.pswpWidth);
    const height = Number(tile.dataset.pswpHeight);
    return width > 0 && height > 0 ? width / height : 1.5;
  });
  if (tiles.length === 0) return;

  const gap = Number.parseFloat(getComputedStyle(track).gap) || 12;

  /** Rebuild the track's columns at the wall's current height. */
  function layout() {
    const height = viewport!.clientHeight;
    if (height <= 0) return;

    const packed = packColumns(aspects, {
      height,
      gap,
      targetWidth: targetWidthFor(height, gap, window.innerWidth),
      maxPerColumn: 4,
    });
    const packedWidth =
      packed.reduce((sum, column) => sum + column.width, 0) + (packed.length - 1) * gap;
    const columns =
      packedWidth >= viewport!.clientWidth
        ? packed
        : fitColumns(aspects, {
            height,
            gap,
            viewportWidth: viewport!.clientWidth,
            maxPerColumn: 4,
          });

    const wrappers = columns.map((column) => {
      const wrapper = document.createElement("div");
      wrapper.className = "photo-column";
      wrapper.style.width = `${column.width}px`;
      for (const item of column.items) {
        const tile = tiles[item.index];
        tile.style.height = `${item.height}px`;
        tile.style.width = "100%";
        wrapper.appendChild(tile);
      }
      return wrapper;
    });
    track!.replaceChildren(...wrappers);
  }

  layout();
  window.addEventListener("resize", layout);
  // Tile sizes come from the content file, not the loaded images, so no load
  // wait is needed — but a late webfont can change the heading's height and
  // therefore the wall's.
  window.addEventListener("load", layout);
}

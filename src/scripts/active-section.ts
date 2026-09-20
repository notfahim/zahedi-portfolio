/**
 * Which section the nav highlights.
 *
 * The probe line sits near the top of the viewport, just under the header: the
 * section being read is the one occupying the space directly below the header,
 * and it keeps the nav until it has very nearly scrolled away. A centre-line
 * probe breaks for a section taller than the screen — reaching the bottom of
 * the photo wall moves the centre into News while half the wall is still on
 * screen.
 *
 * @module active-section
 */

/** A section's vertical extent in document coordinates. */
export interface SectionBox {
  id: string;
  top: number;
  bottom: number;
}

/** How far down the viewport the probe line sits. */
export const PROBE_FRACTION = 0.2;

/**
 * The id of the section to highlight, or `null` when none is under the probe.
 *
 * Within one screen of the bottom the probe sweeps down to the end of the
 * document: past that point the page cannot scroll far enough to bring a later
 * section up to a fixed probe line, so About — shorter than the viewport and
 * followed by the footer — would never be highlighted at all.
 */
export function activeSectionId(
  sections: SectionBox[],
  scrollY: number,
  viewportHeight: number,
  documentHeight: number,
  probeFraction: number = PROBE_FRACTION
): string | null {
  if (sections.length === 0 || viewportHeight <= 0) return null;
  const last = sections[sections.length - 1];

  const maxScroll = Math.max(0, documentHeight - viewportHeight);
  const toEnd = Math.max(0, maxScroll - scrollY);
  const ramp = toEnd < viewportHeight ? 1 - toEnd / viewportHeight : 0;
  const fraction = probeFraction + (1 - probeFraction) * ramp;

  const probe = scrollY + viewportHeight * fraction;
  // Past the final section lies the footer, which has no nav entry of its
  // own; the last section keeps the highlight there.
  if (probe >= last.bottom) return last.id;
  // Last match wins, so adjoining sections (one's bottom is the next's top)
  // resolve to the later one.
  let active: string | null = null;
  for (const section of sections) {
    if (section.top <= probe && probe < section.bottom) active = section.id;
  }
  return active;
}

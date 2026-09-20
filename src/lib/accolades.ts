/**
 * One accolade of the featured film. A win, a nomination and a festival
 * selection are the same shape and share one list in `recognition.json`; the
 * site splits them apart so each is headed for what it is. A selection is not
 * an award — the film was chosen to screen.
 */
export interface Accolade {
  result: "win" | "nomination" | "selection";
  title: string;
  org: string;
  year: number;
}

export interface GroupedAccolades {
  wins: Accolade[];
  nominations: Accolade[];
  selections: Accolade[];
}

/**
 * Newest first, then alphabetical by awarding body, so a festival run reads in
 * a stable order however the JSON happens to be typed in.
 */
function byRecency(a: Accolade, b: Accolade): number {
  return b.year - a.year || a.org.localeCompare(b.org);
}

/** Split one accolade list into the three the site heads separately. */
export function groupAccolades(accolades: Accolade[]): GroupedAccolades {
  const of = (result: Accolade["result"]) =>
    accolades.filter((a) => a.result === result).sort(byRecency);
  return { wins: of("win"), nominations: of("nomination"), selections: of("selection") };
}

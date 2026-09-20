import { describe, it, expect } from "vitest";
import { groupAccolades, type Accolade } from "./accolades";

const accolade = (over: Partial<Accolade> = {}): Accolade => ({
  result: "win",
  title: "Best Cinematography",
  org: "Festival",
  year: 2025,
  ...over,
});

describe("groupAccolades", () => {
  it("splits wins, nominations and selections", () => {
    const grouped = groupAccolades([
      accolade({ org: "A" }),
      accolade({ result: "nomination", org: "B" }),
      accolade({ result: "selection", org: "C" }),
    ]);
    expect(grouped.wins.map((a) => a.org)).toEqual(["A"]);
    expect(grouped.nominations.map((a) => a.org)).toEqual(["B"]);
    // Being chosen to screen is not being shortlisted for an award, and the
    // site must not quietly file one as the other.
    expect(grouped.selections.map((a) => a.org)).toEqual(["C"]);
  });

  it("orders newest first", () => {
    const grouped = groupAccolades([
      accolade({ org: "A", year: 2023 }),
      accolade({ org: "B", year: 2026 }),
    ]);
    expect(grouped.wins.map((a) => a.year)).toEqual([2026, 2023]);
  });

  it("breaks a year tie alphabetically by organization", () => {
    const grouped = groupAccolades([
      accolade({ org: "Zagreb" }),
      accolade({ org: "Busan" }),
    ]);
    expect(grouped.wins.map((a) => a.org)).toEqual(["Busan", "Zagreb"]);
  });

  it("returns empty groups for an empty list", () => {
    expect(groupAccolades([])).toEqual({ wins: [], nominations: [], selections: [] });
  });

  it("does not mutate the input order", () => {
    const input = [accolade({ org: "B", year: 2020 }), accolade({ org: "A", year: 2026 })];
    groupAccolades(input);
    expect(input.map((a) => a.org)).toEqual(["B", "A"]);
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.stubEnv("PUBLIC_MEDIA_BASE_URL", "https://media.zahedishams.com");
  vi.resetModules();
});

describe("renderDetailRows", () => {
  it("builds one element per credit row, including the blank ones", async () => {
    const { renderDetailRows } = await import("./work-expand");
    const nodes = renderDetailRows(
      { projectCategory: "commercial", projectYear: "2026", projectDirector: "A" },
      { createElement: (tag: string) => ({ tag, className: "", textContent: "", children: [] as any[], appendChild(c: any) { this.children.push(c); } }) } as any
    );
    // Category, Client, Director, Year — Client blank.
    expect(nodes).toHaveLength(4);
    expect(nodes.every((n) => n.className === "detail-row")).toBe(true);
  });

  it("puts the label before the value inside a row", async () => {
    const { renderDetailRows } = await import("./work-expand");
    const rows = renderDetailRows(
      { projectCategory: "commercial", projectDirector: "Alex Vance" },
      { createElement: (tag: string) => ({ tag, className: "", textContent: "", children: [] as any[], appendChild(c: any) { this.children.push(c); } }) } as any
    );
    const row = rows[2]; // Category, Client, then Director
    expect((row.children as unknown as any[]).map((c: any) => c.textContent)).toEqual([
      "Director",
      "Alex Vance",
    ]);
  });
});

describe("lastIndexInRowOf", () => {
  // Cards in a CSS grid share an offsetTop when they share a row.
  const tops = [0, 0, 0, 400, 400, 800];

  it("finds the last card of the clicked card's row", async () => {
    const { lastIndexInRowOf } = await import("./work-expand");
    expect(lastIndexInRowOf(tops, 0)).toBe(2);
    expect(lastIndexInRowOf(tops, 1)).toBe(2);
  });

  it("handles a card in a later, partly filled row", async () => {
    const { lastIndexInRowOf } = await import("./work-expand");
    expect(lastIndexInRowOf(tops, 3)).toBe(4);
    expect(lastIndexInRowOf(tops, 5)).toBe(5);
  });

  it("tolerates sub-pixel differences within a row", async () => {
    // Rounding can leave siblings a fraction apart; without tolerance the
    // panel would open mid-row and split it.
    const { lastIndexInRowOf } = await import("./work-expand");
    expect(lastIndexInRowOf([0, 0.4, 400], 0)).toBe(1);
  });

  it("returns the index itself in a single-column layout", async () => {
    const { lastIndexInRowOf } = await import("./work-expand");
    expect(lastIndexInRowOf([0, 300, 600], 1)).toBe(1);
  });
});

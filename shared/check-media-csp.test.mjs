import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkMediaOriginMatchesCsp } from "./check-media-csp.mjs";

function writeVercelJson(csp) {
  const dir = mkdtempSync(join(tmpdir(), "check-media-csp-"));
  const path = join(dir, "vercel.json");
  writeFileSync(
    path,
    JSON.stringify({
      headers: [{ source: "/(.*)", headers: [{ key: "Content-Security-Policy", value: csp }] }],
    })
  );
  return path;
}

describe("checkMediaOriginMatchesCsp", () => {
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  beforeEach(() => warnSpy.mockClear());
  afterEach(() => warnSpy.mockRestore());

  it("skips (does not throw) when the env var is unset", () => {
    expect(() => checkMediaOriginMatchesCsp({ mediaBaseUrl: undefined })).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("passes when the origin is allowed in both img-src and media-src", () => {
    const vercelJsonPath = writeVercelJson(
      "default-src 'self'; img-src 'self' https://media.example.com data:; media-src 'self' https://media.example.com"
    );
    expect(() =>
      checkMediaOriginMatchesCsp({ mediaBaseUrl: "https://media.example.com", vercelJsonPath })
    ).not.toThrow();
  });

  it("throws naming both files when the origin is missing from img-src", () => {
    const vercelJsonPath = writeVercelJson(
      "default-src 'self'; img-src 'self' data:; media-src 'self' https://media.example.com"
    );
    expect(() =>
      checkMediaOriginMatchesCsp({ mediaBaseUrl: "https://media.example.com", vercelJsonPath })
    ).toThrow(/img-src/);
  });

  it("throws naming both files when the origin is missing from media-src", () => {
    const vercelJsonPath = writeVercelJson(
      "default-src 'self'; img-src 'self' https://media.example.com data:; media-src 'self'"
    );
    expect(() =>
      checkMediaOriginMatchesCsp({ mediaBaseUrl: "https://media.example.com", vercelJsonPath })
    ).toThrow(/media-src/);
  });

  it("throws when PUBLIC_MEDIA_BASE_URL and the CSP origin simply differ", () => {
    const vercelJsonPath = writeVercelJson(
      "default-src 'self'; img-src 'self' https://media.zahedishams.com data:; media-src 'self' https://media.zahedishams.com"
    );
    expect(() =>
      checkMediaOriginMatchesCsp({ mediaBaseUrl: "https://cdn.example.com", vercelJsonPath })
    ).toThrow(/vercel\.json/);
  });
});

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Fail the build when the media origin and the CSP disagree.
 *
 * `vercel.json`'s CSP hardcodes the media origin while `src/lib/r2-url.ts`
 * reads `PUBLIC_MEDIA_BASE_URL` from the environment. If the two drift, the
 * build stays green and every image fails in the browser with nothing but a
 * console CSP violation, so this throws instead.
 *
 * Skipped (and logged, not silent) when `PUBLIC_MEDIA_BASE_URL` is unset, so
 * local dev without a `.env` still works.
 *
 * @param {{ mediaBaseUrl?: string, vercelJsonPath?: string, vercelJsonLabel?: string, envLabel?: string }} [options]
 * @throws {Error} When the origin is not a valid URL, or `img-src`/`media-src`
 *   do not allow it.
 */
export function checkMediaOriginMatchesCsp({
  mediaBaseUrl = process.env.PUBLIC_MEDIA_BASE_URL,
  vercelJsonPath = fileURLToPath(new URL("../vercel.json", import.meta.url)),
  vercelJsonLabel = "vercel.json",
  envLabel = "PUBLIC_MEDIA_BASE_URL",
} = {}) {
  if (!mediaBaseUrl) {
    console.warn(
      `[check-media-csp] ${envLabel} is not set — skipping the CSP/media-origin consistency ` +
        `check. Set it (see .env.example) so this check can catch a drift between ${envLabel} ` +
        `and ${vercelJsonLabel} before it reaches production.`
    );
    return;
  }

  let origin;
  try {
    origin = new URL(mediaBaseUrl).origin;
  } catch {
    throw new Error(
      `[check-media-csp] ${envLabel} ("${mediaBaseUrl}") is not a valid absolute URL. ` +
        `Fix it in your .env (see .env.example).`
    );
  }

  const vercelConfig = JSON.parse(readFileSync(vercelJsonPath, "utf-8"));
  const headerRule = vercelConfig.headers?.[0];
  const csp = headerRule?.headers?.find((h) => h.key === "Content-Security-Policy")?.value ?? "";

  const missingFrom = ["img-src", "media-src"].filter(
    (directive) => !cspDirectiveContains(csp, directive, origin)
  );

  if (missingFrom.length > 0) {
    throw new Error(
      `[check-media-csp] ${envLabel} is set to "${mediaBaseUrl}" (origin ${origin}), but ` +
        `${vercelJsonLabel}'s Content-Security-Policy does not allow that origin in: ` +
        `${missingFrom.join(", ")}. Either change ${envLabel} back to the origin already ` +
        `allowed in ${vercelJsonLabel}, or update the ${missingFrom.join(" and ")} directive(s) ` +
        `in ${vercelJsonLabel} to include ${origin}. A mismatch here builds cleanly but CSP-blocks ` +
        `every image and video in the browser.`
    );
  }
}

/**
 * @param {string} csp
 * @param {string} directiveName
 * @param {string} origin
 * @returns {boolean}
 */
function cspDirectiveContains(csp, directiveName, origin) {
  const match = csp.match(new RegExp(`${directiveName}\\s+([^;]+)`));
  if (!match) return false;
  return match[1].split(/\s+/).includes(origin);
}

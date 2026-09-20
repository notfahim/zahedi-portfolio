import { z } from "zod";
import { WORK_CATEGORY_IDS } from "../lib/work-categories";

/**
 * Zod schemas for the four content collections.
 *
 * Two kinds of R2 key flow through them, and typing both as plain strings
 * would let a value of the wrong kind slip in silently:
 *
 * - base keys (`thumbnailKey`, `imageKey`, `portraitKey`, `posterKey`):
 *   `buildDerivativeKey()` appends `/<width>.<format>`, so they must not carry
 *   an extension — `"work/foo-thumb.webp"` would 404 every derivative.
 * - literal keys (`videoKey`, `hoverPreviewKey`, `pressKitKey`, `heroLoopKey`):
 *   used verbatim by `mediaUrl()` and legitimately carry a real extension.
 */

/** An extensionless base key. */
const baseKey = z
  .string()
  .refine(
    (k) => !/\.[a-z0-9]{2,5}$/i.test(k),
    "must be an extensionless base key — buildDerivativeKey appends -<width>.<format>"
  );

/**
 * One project in `work.json`.
 *
 * Everything below the slug is optional: a project is published before its
 * credits are known, and a single missing field must not fail the whole
 * collection and stop the site building — the viewer shows that row blank.
 */
export const workEntrySchema = z.object({
  slug: z.string(),
  title: z.string().optional(),
  category: z.enum(WORK_CATEGORY_IDS).optional(),
  /**
   * The credit fields, allowed on every entry whatever its category, so
   * re-filing a project keeps whatever was already typed into it. Which of
   * them the site shows is the category's business (see
   * `shared/work-categories.mjs`).
   *
   * Spelled out rather than generated from `ALL_CREDIT_FIELDS` so Astro can
   * still infer `project.data.client` and friends; `schemas.test.ts` fails if
   * this list and the shared one drift apart.
   */
  client: z.string().optional(),
  director: z.string().optional(),
  producer: z.string().optional(),
  runtime: z.string().optional(),
  artist: z.string().optional(),
  year: z.number().int().optional(),
  /** Optional: `publish-video` makes one from a video frame. */
  thumbnailKey: baseKey.optional(),
  /**
   * Which derivative widths exist for the thumbnail. Omit to assume all four;
   * see `pickWidth` in `r2-url.ts`.
   */
  thumbnailWidths: z.array(z.number().int().positive()).optional(),
  /** Optional: without a silent hover clip the card simply shows its still. */
  hoverPreviewKey: z.string().optional(),
  /**
   * Literal key of the self-hosted project video, e.g.
   * `"work/commercial/silent-sprint.mp4"` — the category is part of the key,
   * so the bucket is browsable by kind of work. Optional: a stills-only
   * project opens on its still instead of a player.
   */
  videoKey: z.string().regex(/\.mp4$/, "must be a literal .mp4 key, e.g. work/commercial/slug.mp4").optional(),
});

/** One photograph in `photography.json`. */
export const photographyEntrySchema = z.object({
  slug: z.string(),
  imageKey: baseKey,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  caption: z.string(),
  location: z.string(),
  year: z.number().int(),
  camera: z.string().optional(),
  /**
   * Which of `DERIVATIVE_WIDTHS` actually exist for this image: a source under
   * the cap is never enlarged, so it produces fewer real widths than the
   * nominal set. Omitted, `derivativeSrcSet` advertises every configured width.
   */
  widths: z.array(z.number()).optional(),
});

/**
 * One press or podcast item in `news.json`. Awards and nominations are not
 * part of this collection — they belong to the featured film in
 * `recognition.json`, grouped under its poster.
 */
export const newsEntrySchema = z.object({
  type: z.enum(["press", "podcast"]),
  year: z.number().int(),
  title: z.string(),
  org: z.string(),
  /** Optional: a profile piece is about the cinematographer, not a project. */
  project: z.string().optional(),
  link: z.string().url().optional(),
});

/** One award, nomination or festival selection of the featured film. */
export const accoladeSchema = z.object({
  /**
   * All three carry the same fields; the site groups them under separate
   * headings (see `groupAccolades`). A selection is being chosen to screen,
   * not shortlisted for an award.
   */
  result: z.enum(["win", "nomination", "selection"]),
  /** The award itself, e.g. "Best Cinematography". */
  title: z.string(),
  /** The festival or awarding body. */
  org: z.string(),
  year: z.number().int(),
});

/**
 * The News section's featured film and its accolades. Everything else in the
 * section is press, which lives in `news.json`.
 */
export const recognitionSchema = z.object({
  /**
   * Optional, so the section degrades to the press list alone before the
   * poster has been published rather than failing the build.
   */
  film: z
    .object({
      title: z.string(),
      year: z.number().int(),
      /**
       * A base key from `publish-image` — the poster is the only image in this
       * section, and no copy of the film itself is hosted.
       */
      posterKey: baseKey,
      posterWidths: z.array(z.number().int().positive()).optional(),
      posterAlt: z.string(),
      /** One or two lines under the title. */
      logline: z.string().optional(),
      /** The credit on the film, e.g. "Director of Photography". */
      role: z.string().optional(),
    })
    .optional(),
  accolades: z.array(accoladeSchema).default([]),
});

/** `about.json`: the biography, contact details and site-level media. */
export const aboutSchema = z.object({
  bio: z.string(),
  /**
   * The line above the name in the header ("Director of Photography").
   * Optional; the header falls back to a sensible default.
   */
  role: z.string().optional(),
  representation: z.array(
    z.object({
      label: z.string(),
      contact: z.string(),
    })
  ),
  directInquiryEmail: z.string().email(),
  /**
   * Written how it should read ("+880 1844-000334"); the wa.me link strips it
   * to digits. Without it, About falls back to the email.
   */
  whatsappNumber: z.string().optional(),
  location: z.string(),
  /**
   * Footer social links, rendered only when non-empty so an unconfigured site
   * shows no link rather than a dead `href="#"`.
   */
  socials: z
    .array(z.object({ label: z.string(), url: z.string().url() }))
    .optional(),
  /** Without it no button renders, rather than a link to a missing PDF. */
  pressKitKey: z.string().optional(),
  /**
   * Landing-page background. A still (`heroImageKey`, a base key) takes
   * priority over a video loop (`heroLoopKey`, a literal `.mp4` key). With
   * neither, the hero shows the plain page background.
   *
   * These site-level fields live in `about.json` rather than a collection of
   * their own because it is already the single-object, `"site"`-keyed file.
   */
  heroImageKey: baseKey.optional(),
  heroImageWidths: z.array(z.number().int().positive()).optional(),
  heroLoopKey: z.string().optional(),
  portraitKey: baseKey,
  portraitWidths: z.array(z.number().int().positive()).optional(),
  portraitAlt: z.string(),
  /**
   * Optional as a pair with `reelTitle`: the hero's "Play Reel" button renders
   * nothing rather than a dead button when the reel is not configured yet.
   */
  reelVideoKey: z
    .string()
    .regex(/\.mp4$/, "must be a literal .mp4 key, e.g. about/reel.mp4")
    .optional(),
  reelTitle: z.string().optional(),
});

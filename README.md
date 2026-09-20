# Zahedi Shams — Portfolio

Live at **[zahedishams.com](https://zahedishams.com)**.

The portfolio website for **Zahedi Shams, Director of Photography /
cinematographer**. One long page (`src/pages/index.astro`) with four sections —
Work, Photography, News & Press, About — plus a 404. Astro 5, static output,
deployed to Vercel. Media (images, video, press kit) is not in the repo: it
lives in a Cloudflare R2 bucket and is referenced by key.

The design intent is in [`docs/design-spec.md`](docs/design-spec.md), with
per-section wireframes in `wireframes/`.

## Commands

```bash
npm run dev            # astro dev
npm run build          # astro build (fails on a CSP/media-origin mismatch, see below)
npm run check          # astro check (types)
npm test               # vitest run — unit tests only, no browser
npm run check-media    # every key the content files reference vs. what R2 holds
```

## Content

The four JSON files in `src/content/` are the site's content, loaded as Astro
collections (`src/content/config.ts`) and validated by Zod schemas in
`src/content/schemas.ts`. Nearly every field is optional on purpose: a missing
credit must not fail the collection and stop the build.

Which credits a project shows is its category's business, and the five
categories live in `shared/work-categories.mjs` — imported by both the browser
build and the publish CLIs, so a category, its label and its credit fields are
defined once:

| Category | Beyond title, category, year |
| --- | --- |
| Commercial | client, director |
| Short Film / Feature | director, producer, runtime |
| Documentary | client, runtime |
| Music Video | artist, director |

The schema allows every credit field on every entry, so re-filing a project
under another category keeps what was already typed into it; the viewer shows
only the rows that category asks for.

Two kinds of R2 key flow through the schemas and must not be mixed up:

- **base keys** (`thumbnailKey`, `imageKey`, `portraitKey`, `posterKey`) carry
  no extension. `buildDerivativeKey()` appends `/<width>.<format>`, so each
  image is really 8 objects (4 widths × avif/webp).
- **literal keys** (`videoKey`, `hoverPreviewKey`, `pressKitKey`, `heroLoopKey`)
  are real filenames, used verbatim.

A `widths` / `*Widths` list records which derivative widths actually exist —
sources smaller than the 2560px cap are never enlarged, so a hardcoded width
would 404. Omit it and all four widths are assumed.

## Publishing media

The publish CLIs upload to R2 **and** write the content file, so the `widths`
list can't be forgotten:

```bash
npm run publish-image  -- <folder> <slug> <path>
npm run publish-video  -- <folder> <slug> <path>          # needs ffmpeg/ffprobe
npm run publish-folder -- <folder> <disk-folder> [--force]
```

`<folder>` is the R2 folder, and for work it names the category too —
`work/commercial`, `work/short-film`, `work/feature`, `work/documentary`,
`work/music-video` (plus `photography`, `news`, `about`). A bare `work` is
refused: the category is part of the key, and it is also the category the new
work.json entry gets. So one run per category folder:

```bash
npm run publish-folder -- work/commercial ~/Videos/commercials
npm run publish-folder -- work/music-video ~/Videos/music-videos
```

`publish-folder` shells out to the other two rather than reimplementing them.
All four scripts share `scripts/lib/` (R2 client, sharp, ffmpeg) and `shared/`
(key format, content-file writers) — `shared/` is imported by both the Node
CLIs and the browser build, which is why it is plain `.mjs`.

R2 credentials (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_BUCKET_NAME`) and `PUBLIC_MEDIA_BASE_URL` live in `.env`, which is
gitignored; `.env.example` lists them. Setup for each service is in
[`docs/setup/external-services.md`](docs/setup/external-services.md).

## Two things that fail loudly on purpose

- `astro.config.mjs` calls `checkMediaOriginMatchesCsp()` at build time: if
  `PUBLIC_MEDIA_BASE_URL` and the CSP in `vercel.json` disagree, the build
  fails rather than shipping a site where every image is CSP-blocked.
- `vercel.json.test.ts` asserts the security headers, including that
  `'unsafe-inline'` stays on `script-src`/`style-src` — Astro inlines this
  project's component scripts and PhotoSwipe sets inline styles, so removing
  it silently breaks the scroll engine, both lightboxes and the photo wall.

## Client-side scripts

`src/scripts/` holds the browser code, each file exporting an `init*()` the
relevant `.astro` component calls, with the pure logic split out and unit
tested (`activeSectionId`, `packColumns`, `titleScaleCap`, …). Scrolling is
Lenis, driven by a bare `requestAnimationFrame` loop in `scroll.ts`; the photo
wall and both lightboxes opt out with `data-lenis-prevent`.

## License

MIT — see [LICENSE](LICENSE). Built by Kh. Fahim Shahriar — [github.com/notfahim](https://github.com/notfahim).

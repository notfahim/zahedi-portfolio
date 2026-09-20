# Content & Asset Checklist

What's needed to replace the placeholder fixture content (Task 3) with the
real site. Organized by section.

## Fonts

Spec §10/§16: the layout mirrors gipsova.com's typographic rhythm but does
not reuse its exact font files. This plan ships a free stand-in pairing
(Cormorant Garamond + Inter, self-hosted via `@fontsource`). Provide either:
- specific licensed font files/names to use instead, or
- sign-off to keep the stand-in pairing.

## Work section (`work.json` — one entry per project)

Every project shows its title, category and year. **What sits between them
depends on the category** — so what you need to gather differs per project:

| Category | Credits to gather |
|---|---|
| `commercial` | client, director |
| `short-film` | director, producer, run time |
| `feature` | director, producer, run time |
| `documentary` | — nothing beyond title, category, year |
| `music-video` | artist, director |

Run time is free text, written as it should read (`"18 min"`,
`"1 h 52 min"`). The category is set for you from the folder you publish
from — `npm run publish-folder -- work/short-film ~/Movies/short-films` —
and it also decides where the files live in the bucket.

Everything but the slug and the video is optional — a missing field shows
blank rather than breaking the build. Also per project: a thumbnail image
(made for you by `publish-video`), optionally a short silent hover-preview
clip, and the video itself.

## Photography section (`photography.json` — one entry per photo)

Per photo: the source image file at full resolution (the publish script in
Task 15 downsamples it — never hand it a pre-shrunk copy), caption/title,
location, year, camera (optional).

## News & Press (`recognition.json` + `news.json`)

`recognition.json` holds the featured film and its accolades:
- The film: title, year, your credit on it, an optional logline, and a
  **poster image** (published with `publish-image` — the film itself is not
  hosted).
- Its accolades: one entry per award, nomination or festival selection, each
  with `result` (`win` / `nomination` / `selection`), the title, the awarding
  body or festival, and the year. `selection` covers being chosen to screen
  (official selection, opening film) rather than shortlisted for a prize.

`news.json` holds press and podcast items only: type (`press` / `podcast`),
year, title, organization/publication, optional related project, optional
outbound link.

## About section (`about.json`)

Bio copy; a portrait/behind-the-scenes photo; representation contacts
(agency name + email, and/or a direct-inquiry email); location string
(e.g. "Available Worldwide"); a press kit / CV PDF file.

## R2 key fields — two different shapes

Every image/video field in the JSON content is an R2 object key, but there
are two incompatible shapes and the schema now rejects the wrong one:

- **Base keys** — `thumbnailKey` (work.json), `imageKey` (photography.json),
  `posterKey` (recognition.json), `portraitKey`, `heroImageKey` (about.json). These must be **extensionless**, e.g.
  `"work/commercial/nike-silent-sprint-thumb"` or
  `"photography/neon-shadows-tokyo"`. The publish CLI's `buildDerivativeKey`
  appends `/<width>.<format>` to build the real object key
  (`work/commercial/nike-silent-sprint-thumb/1280.webp`) — each image gets its
  own folder — so
  a base key that already ends in `.webp`/`.jpg`/etc. produces a key that
  was never uploaded and 404s.
- **Literal keys** — `hoverPreviewKey`, `videoKey` (work.json),
  `pressKitKey`, `heroLoopKey`, `reelVideoKey` (about.json). These are used
  exactly as written and **must** carry their real file extension, e.g.
  `"work/commercial/nike-silent-sprint-preview.mp4"` or `"about/press-kit.pdf"`.

When in doubt: if `publish-image.mjs` generated it, it's a base key with no
extension; if it's a single file you uploaded directly (a video clip, a
PDF), it's a literal key with its real extension.

## Site-wide

- Favicon.
- Social links for the footer: Instagram, Vimeo, IMDb, LinkedIn.
- The hero showreel loop (silent, self-hosted, Work section).
- Your real domain name(s) — needed to replace the placeholder
  `zahedishams.com` references in `vercel.json`'s CSP (Task 14) and the
  hotlink-protection rule above.

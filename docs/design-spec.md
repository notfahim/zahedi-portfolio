# Zahedi Shams Portfolio Site — Design

Date: 2026-09-13 (revised 2026-09-14 — Photography section redesign;
fixed-header nav layout corrected to match reference)

## 1. Overview

A single-page portfolio website for Zahedi Shams (Director of Photography /
cinematographer), styled after [gipsova.com](https://gipsova.com/#): a linear,
scroll-driven layout with a header that starts centered on load and morphs
into a fixed top bar as the visitor scrolls. The site is pure static content —
no viewer input, no backend, no CMS. All copy lives in JSON files; all media
is pre-processed and pushed to object storage ahead of time.

Four sections, in nav order: **Work → Photography → News & Press → About**.

## 2. Non-goals

- No contact form, no newsletter signup, no other viewer-submitted data. (The
  wireframes originally sketched both; both are explicitly cut. About is pure
  static content — bio, representation contacts, press-kit link.)
- No CMS or admin UI. Content changes are a hand-edited JSON commit plus a
  locally-run image-publish script.
- No true DRM on media. Security measures below are deterrents and access
  controls, not a guarantee against a determined bad actor screenshotting or
  recording a rendered page.
- No download-proofing on video. Videos are self-hosted in R2 and served as
  plain MP4 files, so the URL is reachable by anyone who opens a network
  panel. The player's own download control is suppressed and hotlinking is
  blocked at the edge; neither is a lock (see §8).
- No pagination/infinite-scroll for the photo wall or work grid in v1 — volume
  is assumed to be small enough (tens of photos, a handful of projects) to
  render in full with lazy-loaded images.

## 3. Site structure

Single Astro route, `src/pages/index.astro`, composed as:

```
<Header />                          -- persistent, see §6
<main>
  <WorkSection id="work">           -- hero + project grid
  <PhotographySection id="photography">  -- pannable collage photo wall, see §7
  <NewsSection id="news">           -- awards + press
  <AboutSection id="about">         -- bio, contacts, press kit
</main>
<Footer />                          -- social links, copyright, back-to-top
```

Nav links (`#work`, `#photography`, `#news`, `#about`) scroll-to-anchor via
Lenis. A single `ScrollTrigger` context spans the whole page (one Lenis
instance, one scroll timeline) — sections don't get independent scroll
contexts.

## 4. Content model

Four Zod-validated Astro Content Collections (`src/content/config.ts`), each
backed by one JSON file under `src/content/`:

**`work.json`** — array of project entries:
```
slug, title, category ("commercial" | "short-film"), director, dop, colorist,
camera, year, awards[], thumbnailKey (R2 key), hoverPreviewKey (R2 key, short
silent clip), videoKey (literal R2 key of the full video, ending .mp4)
```

**`photography.json`** — array of photo entries:
```
slug, imageKey (R2 key, extensionless base key — derivative set generated
at publish time), width, height (pixel dimensions of the capped derivative,
used as PhotoSwipe's declared slide size), caption, location, year, camera
(optional), widths (optional — which of the nominal srcset widths were
actually produced; see §5's withoutEnlargement note)
```
`aspect` does not exist — nothing reads it (row-span layout is computed
from `width`/`height`), and a hand-authored string could silently
contradict the real dimensions.

**`news.json`** — array of recognition entries:
```
type ("award" | "press" | "podcast"), year, title, org, project, link
(optional, external)
```

**`about.json`** — single object. Alongside the per-visitor content fields,
this file also holds site-level media/identifiers that don't belong to any
one collection entry (Work's hero loop and reel, About's own portrait) —
`about.json` is the natural home since it's already the single-object,
`"site"`-keyed file:
```
bio (rich text/markdown string), representation[] (label + contact string),
directInquiryEmail, location, pressKitKey (R2 key, PDF),
heroLoopKey (R2 key, silent hero loop video — Work section),
portraitKey (R2 key, extensionless base key — About section portrait),
portraitAlt, reelVideoKey, reelTitle (both optional as a
set — the Work hero's "Play Reel" button renders nothing when they're
absent, rather than a dead button)
```

Zod schemas enforce these shapes at build time — a malformed entry fails the
build rather than rendering broken content.

## 5. Image pipeline

A local Node script, `scripts/publish-image.mjs`, run by hand whenever media
is added:

1. Takes a source image path (kept outside git, e.g. a local `media/`
   folder — the true master/RAW file never enters the repo or the bucket).
2. Sharp generates a capped-resolution derivative set: longest edge ≤ 2560px,
   WebP + AVIF, at a few widths for `srcset` (e.g. 640/1280/1920/2560). No
   blurhash or other placeholder is generated — nothing in the site decodes
   or renders one, images already carry explicit `width`/`height` (so no
   layout shift) plus `loading="lazy"`, and a client-side blurhash decoder
   would be dead weight on a deliberately lean site.
3. Uploads derivatives to the R2 bucket (S3-compatible SDK) under a
   content-hashed key.
4. Prints a paste-ready `photography.json` entry (id/slug/imageKey derived
   from the CLI's own arguments, measured width/height, and which of the
   nominal widths were actually produced) for the operator to paste and
   fill in the remaining placeholders (caption/location/year).

**`withoutEnlargement` and narrow sources**: Sharp's resize is called with
`withoutEnlargement: true`, so a source narrower than one of the nominal
`srcset` widths does not get upscaled to fill it — the derivative set for
that image simply has fewer real widths than the nominal 640/1280/1920/2560
set (down to a minimum of one, the smallest configured width). The CLI
reports which widths actually exist, and that list is recorded as the
entry's optional `widths` field so the site's `srcset` never advertises a
width that was never uploaded.

**This is the entire security posture for images**: the public bucket only
ever holds display-resolution, quality-compressed derivatives. There is no
full-res download path anywhere in the site, so there's nothing to sign or
expire. The R2 bucket sits behind a Cloudflare-proxied custom domain (e.g.
`media.zahedishams.com`) with zone-level hotlink/referrer-check protection
(a Cloudflare WAF custom rule — no Worker, no signing code) so other
sites can't hotlink the images directly.

## 6. Header behavior

On load: centered, large title block (name + role), no nav bar visible —
matches the wireframe's title-card look and the gipsova.com reference. Once
the visitor scrolls past the Work hero, GSAP `ScrollTrigger` animates the
header into a compact, fixed top bar — the name stays centered (it does not
relocate to the left; it only shrinks/compacts in place), with the four nav
links split into two groups flanking it (WORK, PHOTOGRAPHY on the left;
NEWS & PRESS, ABOUT on the right), preserving the original left-to-right nav
order. This bar stays pinned for the rest of the page. The same
`ScrollTrigger` tracks scroll position to highlight whichever nav item
corresponds to the section currently in view.

## 7. Photography section

A fixed, full-viewport-height (`100vh`) panel containing a horizontally
scrolling collage "wall" — not a normal vertically-flowing grid. Photos are
laid out as a CSS Grid collage (`grid-auto-flow: column`, with a varied
`grid-row: span N` per tile for the collage look), populated from
`photography.json`. Images lazy-load via native `loading="lazy"`.

**Not `dense` packing** (corrected 2026-09-14; earlier drafts of this
section said "dense collage", which was wrong). `grid-auto-flow: column
dense` backfills gaps by pulling *later* items into earlier holes, so the
visual order stops matching DOM order. PhotoSwipe collects its slides in DOM
order, so with dense packing a visitor who clicks a photo and presses "next"
would jump to a photo that isn't the one beside it — incoherent in a gallery.
The cost of plain `column` is an occasional gap where a tall tile won't fit
the rows remaining in a column, which in a collage reads as intentional
negative space. Visual/navigation coherence wins over gap-free packing.

**Idle auto-pan**: a `requestAnimationFrame` loop slowly scrolls the track
horizontally at a steady rate, reversing direction at each end (ping-pong)
rather than an infinite seamless loop — a seamless loop would require
duplicating every photo in the DOM, which then double-counts entries for the
lightbox's prev/next navigation. Disabled entirely (panel stays static) for
visitors with `prefers-reduced-motion` set.

**Pause + interact on hover**: `pointerenter` on the panel cancels the
auto-pan and hands control to the visitor — native horizontal scroll
(wheel/trackpad/drag/scrollbar all work, since it's a real `overflow-x`
scroller, styled with a thin custom scrollbar) plus photo clicks, which open
PhotoSwipe v5 with a custom caption UI showing title, location, and year (per
the `photo lightbox.txt` wireframe). `pointerleave` resumes auto-pan after a
short delay so a stray cursor pass doesn't immediately interrupt browsing.

**Nested-scroll conflict**: Lenis intercepts wheel events for the page's
vertical smooth-scroll by default, which would otherwise fight this panel's
nested horizontal scroll. The panel is opted out of Lenis via its
`data-lenis-prevent` attribute so it behaves as normal native scroll.

No category filter on this section for v1 (the wireframe shows one
continuous wall) — call it out if that's wrong.

## 8. Video handling

- **Hero (Work section)**: a short, silent, self-hosted loop (R2, same
  capped-resolution treatment as photos) plays as ambient background — no
  third-party embed on initial page load.
- **Work grid hover preview**: each project card has its own short, silent,
  self-hosted preview clip (R2), separate from the full video — keeps the
  grid light.
- **Full video (click-through)**: opens a custom video lightbox (not
  PhotoSwipe — image-only). Only on open does it mount the player: a
  `<video>` element pointed at the R2 object, constructed and inserted by JS
  at click time. Closing the lightbox removes that element from the DOM,
  which is what actually stops playback.
- **What the facade does and does not buy us** (revised 2026-09-17 for
  self-hosting). It genuinely delivers: nothing is fetched until a visitor
  clicks, no third party is involved at any point, and playback truly stops
  on close because the element is destroyed. It does NOT hide the video: each
  card carries `data-video-key` in the HTML and the media domain ships in the
  JavaScript, so the file's URL is trivially reconstructed. On a static site
  with no backend
  this is unavoidable — the browser must know the hash in order to play the
  video, and any client-side obfuscation would be reversible theatre rather
  than protection. Treat the facade as a performance-and-privacy-on-load
  measure plus a speed bump, not as concealment.
- **Why self-hosted rather than a video platform** (decided 2026-09-17).
  Vimeo's Free plan caps an account at 1 GB for its lifetime, against 3.5 GB
  of masters, so it was never viable. YouTube is free and unlimited, but its
  terms permit ads on videos from channels outside the Partner Program, and
  the player carries its branding and suggested videos — wrong for a
  cinematographer's reel. R2 already hosts the images, includes 10 GB of
  storage free, and charges nothing for bandwidth; 3.5 GB of masters encode
  to well under that.
- **Accepted consequences**: one 1080p rendition for every viewer, with no
  adaptive switching on a weak connection; no platform analytics; and the
  file is downloadable by anyone who reads a network panel.

## 9. Animation & scroll stack

- **Lenis** provides the single smooth-scroll instance for the whole page.
- **GSAP + ScrollTrigger** hooks into Lenis's scroll event via
  `lenis.on("scroll", ScrollTrigger.update)` plus `gsap.ticker` driving
  `lenis.raf()` — correct for Lenis 1.x (an earlier draft of this section
  said "via `scrollerProxy`", which is stale/incorrect for this Lenis
  version; fixed here rather than in the code). ScrollTrigger does exactly
  two jobs with this: the header morph (§6) and nav active-state
  highlighting. There are no section reveal animations (fade/slide-in) —
  an earlier draft of this section claimed them; they were never
  implemented.
- The photo wall's idle auto-pan (§7) is a self-contained `rAF` loop, separate
  from the GSAP/Lenis page-scroll machinery, and the panel is explicitly
  excluded from Lenis's wheel handling (§7) so the two scroll systems don't
  fight each other.
- PhotoSwipe and the video lightbox manage their own open/close animations
  independently — they aren't driven through GSAP. Both lightboxes also stop
  Lenis while open (`overlay:open`/`overlay:close` events, handled in
  `scroll.ts`) since Lenis only honors `data-lenis-prevent` and neither
  lightbox has its own scroll lock — without this, the page underneath
  would keep smooth-scrolling on wheel input while a lightbox is open.

## 10. Typography & sizing

Starting point mirrors gipsova.com's typographic scale and spacing rhythm
(hierarchy, line-length, whitespace density) as a baseline to build from —
not a literal asset copy, since the reference site's specific font files
aren't licensed for reuse here. Pick a freely-licensed serif/sans pairing
with similar character unless/until specific licensed fonts are supplied.

## 11. Security summary

- Images: capped-resolution derivatives only, no full-res path (§5), plus
  Cloudflare hotlink protection on the media domain.
- Video: self-hosted in R2 behind the same hotlink rule as the images,
  mounted only on click (§8); the player's download control is suppressed,
  which is a deterrent and not a lock.
- No forms anywhere → no submission endpoint, no spam/rate-limit surface.
- Standard hardening via `vercel.json`: CSP, `X-Content-Type-Options`,
  `Referrer-Policy`, no `X-Powered-By`, no exposed source maps in the
  production build.
- No admin surface, no auth, no database — the static-content, no-CMS
  decision (§2) is itself a big chunk of the attack-surface reduction.

## 12. Tech stack

Astro (static output) · GSAP + ScrollTrigger · Lenis · Cloudflare R2 + Sharp
(image pipeline) · PhotoSwipe v5 · CSS Grid collage layout for the photo
wall (§7 — no JS masonry library; `masonry-layout` was dropped since nothing
else in the spec needs it) · self-hosted MP4 video with a click-to-mount
player · ffmpeg encode step ·
JSON content collections. Deployed to **Vercel**.

## 13. Repository layout

```
src/
  pages/index.astro
  components/
    Header.astro, Footer.astro
    sections/
      WorkSection.astro, PhotographySection.astro, NewsSection.astro, AboutSection.astro
    work/ProjectCard.astro
    photography/PhotoTile.astro
    news/NewsCard.astro
    lightbox/VideoLightbox.astro
  content/
    config.ts, schemas.ts    -- Zod schemas
    work.json, photography.json, news.json, about.json
  lib/
    r2-url.ts                -- mediaUrl/derivativeUrl/derivativeSrcSet
  scripts/                   -- client-side JS
    scroll.ts               -- Lenis + ScrollTrigger wiring, header morph
    photo-wall.ts, photo-wall-pan.ts  -- collage layout, idle auto-pan, hover pause/resume
    photo-lightbox.ts, video-lightbox.ts, work-filter.ts
  styles/
    tokens.css, global.css
scripts/                      -- repo-root, Node build-time tooling
  publish-image.mjs
  lib/r2-client.mjs, sharp-derivatives.mjs
shared/
  media-config.mjs            -- the single load-bearing contract shared by
                                  scripts/publish-image.mjs (Node) and
                                  src/lib/r2-url.ts (browser): derivative
                                  widths/formats and the buildDerivativeKey()
                                  string template. Both sides import this
                                  instead of each re-implementing the key
                                  format independently.
  check-media-csp.mjs         -- build-time assertion that
                                  PUBLIC_MEDIA_BASE_URL's origin is allowed
                                  in vercel.json's CSP (img-src/media-src)
media/                         -- local-only source originals, gitignored
vercel.json
astro.config.mjs
```

The pre-existing `wireframes/` stay as reference docs.

## 14. Deployment

- **Vercel**: Astro static build, `vercel.json` for security headers.
- **Cloudflare R2**: media bucket, fronted by a Cloudflare-proxied custom
  domain (`media.<domain>`) with a hotlink/referrer-check rule at the zone
  level.
- **Video hosting**: none — videos live in the same R2 bucket as the images,
  encoded to a single web-ready MP4 by a local ffmpeg step.

## 15. Testing strategy

- `astro check` + Content Collection schema validation as the build-time
  correctness gate — a bad JSON entry fails the build.
- Vitest unit tests around `publish-image.mjs`'s pure logic: derivative
  sizing math, R2 key naming/hashing.
- Manual QA checklist (no automated e2e in v1): header morph timing, anchor
  scroll behavior, collage reflow at mobile/tablet/desktop breakpoints,
  photo wall idle auto-pan + hover pause/resume timing + ping-pong reversal
  at both ends, `prefers-reduced-motion` behavior, video facade
  mount-on-click and unmount-on-close, PhotoSwipe caption content
  correctness.

## 16. Open risks / accepted gaps

- Self-hosted video serves one quality to everyone and can be downloaded by
  anyone who looks for the URL (§8) — accepted. Revisit with a streaming
  service if either becomes a real problem.
- No literal reuse of gipsova.com's exact fonts/assets (§10) — a look-alike
  pairing stands in until real licensed fonts are chosen.
- Content authoring is fully manual (hand-run script + hand-edited JSON,
  confirmed acceptable — no CMS wanted).
- Photo wall auto-pan is ping-pong, not a seamless infinite loop (§7) —
  accepted trade-off to avoid duplicating lightbox entries; revisit if a
  seamless loop matters more than lightbox index simplicity.

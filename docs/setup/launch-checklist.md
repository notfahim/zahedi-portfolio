# Launch Checklist

The site is built and its test suite is green, but **nothing here has ever been
rendered in a browser** — no browser automation existed in the environment that
built it. Every piece of motion and interaction below is unverified by anyone.
This checklist is the honest substitute for that testing, plus everything the
site still needs from you.

**For the ordered, step-by-step version of all of this, see
`go-live-steps.md`.** This file is the reference detail behind it: what each
item is, and why it matters.

---

## A. Known issues to fix before launch

**A1 (blank credit lines in the reel lightbox) and A3 (dead `href="#"` footer
social links) are fixed.** Footer socials now come from an optional `socials`
array in `about.json`; omit it and no social links render.

### A2. `work.json` is empty until you publish

`work.json` is `[]` — the bucket is organised by category now
(`work/commercial/…`, `work/short-film/…`), and each entry is written by the
run that publishes its video. Until then the Work grid is empty and all five
filter buttons are dimmed, which is the correct rendering of "no projects
yet", not a fault.

Publish one category folder at a time (see `go-live-steps.md` Stage 4):

```bash
npm run publish-folder -- work/commercial ~/Movies/commercials
```

`about.json` has no `reelVideoKey`, so no Play Reel button renders. Publish a
reel with `npm run publish-video -- about reel ~/Movies/reel.mov` to bring it
back, or leave it as it is.

## B. Content and assets you need to supply

See `asset-checklist.md` for the full per-section list. Summary of what
nothing can be verified without:

| Item | Where it goes |
|---|---|
| Project videos → published with `publish-video -- work/<category>`, key in `videoKey` | `src/content/work.json` |
| Project thumbnails (automatic) + silent hover-preview clips | R2, beside the video in its category folder |
| Hero showreel loop (silent) | R2, `heroLoopKey` in `about.json` |
| Photographs | published via the CLI, entries pasted into `photography.json` |
| Featured film poster | published to R2, `posterKey` in `src/content/recognition.json` |
| Its awards + nominations | `src/content/recognition.json` |
| Press / podcast items | `src/content/news.json` |
| Per-project credits — the set depends on the category (see `asset-checklist.md`) | `src/content/work.json` |
| Bio, representation contacts, location | `src/content/about.json` |
| Portrait photo + its alt text | R2, `portraitKey`/`portraitAlt` in `about.json` |
| Press kit PDF | R2, `pressKitKey` in `about.json` |
| Favicon, and an Open Graph image if you want link previews | `public/`, referenced from `BaseLayout.astro` |
| Real domain + media subdomain | `vercel.json` CSP **and** `PUBLIC_MEDIA_BASE_URL` |

**The domain appears in two places and they must match.** The build now fails
with an explicit error if they drift, so you can't ship that mistake silently —
but you do have to change both.

### Two shapes of R2 key — easy to get wrong

- **Base keys** (no file extension): `thumbnailKey`, `imageKey`, `portraitKey`.
  The code appends `-<width>.<format>` itself. A trailing extension here now
  fails the build with an explanatory message.
- **Literal keys** (with extension): `hoverPreviewKey`, `heroLoopKey`,
  `pressKitKey`. Used exactly as written.

---

## C. Browser QA — nothing below has ever been observed

Run with DevTools open and the console visible.

### C0. Highest risk — check these first

1. **Header legibility after it compacts.** Scroll past the hero. The name and
   four nav links should sit on a blurred dark bar. If the bar is transparent
   over the photo wall, the background rule isn't applying.
2. **Scrolling behind an open lightbox.** Open a photo, then scroll. The page
   underneath must stay put. Close it — you should be exactly where you were.
   Repeat with a project video. (This was broken and fixed; it's unverified.)
3. **Every image loads.** Network tab, filter to your media domain, expect zero
   404s. A 404 almost certainly means a key-shape mistake — check whether that
   entry's base key wrongly carries a file extension.

### C1. Motion and interaction

4. **Header morph point.** Scroll slowly through the hero's bottom edge — one
   clean toggle, no flicker, and it reverses on the way back up.
5. **Photo wall arrows.** The wall no longer moves on its own. The right
   arrow shows at the start, both show in the middle, and the left one alone
   at the end. Each press advances about 85% of a screen.
6. **Photo wall on touch.** On a phone you swipe the wall directly; the
   arrows remain as a hint that there is more.
7. **Lightbox prev/next order.** Open the first photo, press → repeatedly. The
   order must match what you see left-to-right.
8. **Hover previews.** Each Work card should cross-fade its poster to a muted
   clip within ~300ms, restart each hover, and pause on leave.
9. ~~**Video lightbox.**~~ **Verified in Chrome 2026-09-17**, with a real
   file playing unmuted: the player is created only on click, Escape closes
   it, the element is destroyed (so audio stops), focus returns to the
   button, and right-click is suppressed. Still worth one manual pass with
   your own video, especially on a phone.
10. **Category filter.** All plus the five categories reflow the grid; a
    category with no projects is dimmed and does nothing when clicked.
10b. **Per-category credits.** Open one project of each kind and check the
    viewer's rows: a commercial shows Client/Director, a short film
    or feature Director/Producer/Run Time, a music video Artist/Director, a
    documentary just Category and Year. Verified in Chrome 2026-09-18 against
    sample entries; worth one pass with your real content.

### C2. Layout and responsive

11. **Phone at 390px and 360px.** The photo wall's bottom edge shouldn't be
    clipped by the address bar. Nothing should scroll sideways.
12. **Anchor offsets.** Click each nav link and "Back to top" — section
    headings must clear the fixed header, not tuck under it.
13. **Reduced motion.** With the OS setting on, nothing should drift by
    itself. Smooth-scroll is still active — decide if that's acceptable.
14. **Collage rhythm on real photos.** Tile sizes come from aspect ratio
    (portraits tall, panoramas short). Tune the thresholds in
    `PhotographySection.astro`'s `rowSpanFor` once you see your own work in it.

---

## D. Deploy, and the one loop never exercised

15. ~~**Publish a real photo end to end**~~ — **verified 2026-09-16.** A 7MB
    source produced all 8 derivatives; each is served from
    `media.zahedishams.com` with HTTP 200 and the correct `Content-Type`
    (`image/avif` / `image/webp`). The credentials, bucket, Sharp pipeline,
    key naming and custom domain are all confirmed working together. Command
    for reference:
    ```
    npm run publish-image -- photography some-slug ./path/to/photo.jpg
    ```
    Confirm: all derivatives land in R2; `Content-Type` reads `image/webp` /
    `image/avif` in the R2 console; the printed JSON entry pastes into
    `photography.json` and the build passes; the URLs load in a browser.
16. **Confirm hotlink protection works** — the image should load on your site
    and be blocked when embedded from another origin.
17. `vercel --prod`, then verify the security headers actually arrive:
    `curl -I https://yourdomain` should show the CSP, `X-Frame-Options`,
    `X-Content-Type-Options` and `Referrer-Policy`. The test suite only checks
    the config file's shape — it cannot prove the live response.

---

## What the automated checks do and don't cover

`npm test` (43 tests) covers pure logic: URL construction, the derivative key
format, image capping and width selection, category matching, the video
player's attributes and ffmpeg encode arguments, the photo wall's pan
arithmetic, content schemas, and the security-header config's shape.

It does **not** cover: anything rendered, any motion, any pointer or keyboard
interaction, any real network call, or the R2 upload path. That's what section
C is for.

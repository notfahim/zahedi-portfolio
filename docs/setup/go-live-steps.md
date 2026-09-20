# Go-Live Steps

Every remaining action, in dependency order. Each one is small enough to do in
a sitting. Do not reorder — steps 1–4 unlock everything after them.

Two things are true throughout:

- **`npm run dev` already works** and needs none of this. Use it after every
  stage to see what changed.
- **Nothing here has been seen in a browser yet.** Stage 6 is where that gets
  checked, and it is not optional.

---

## Stage 1 — Domain and DNS  *(blocks everything else)*

- [x] **1.1** Buy your domain (e.g. `zahedishams.com`) if you don't own it.
- [x] **1.2** Create a free Cloudflare account.
- [x] **1.3** Add the domain as a Cloudflare zone and change the nameservers at
      your registrar to the two Cloudflare gives you.
- [x] **1.4** Wait for the zone to read **Active** (minutes to a few hours).
      R2's custom domain in 2.3 will not work until it does.

> **Verified done (2026-09-16).** `zahedishams.com` resolves to Cloudflare
> nameservers (`clarissa`/`terry.ns.cloudflare.com`) and the zone is live.

---

## Stage 2 — Cloudflare R2  *(where every photo, clip and PDF lives)*

- [x] **2.1** R2 → **Create bucket**, name it `zahediportfolio`.
- [x] **2.2** Create the API token. It is **not** on the bucket page — it lives
      on the R2 **Overview** page, in the **Account Details** panel down the
      right-hand side:

      **Storage & databases → R2 → Overview**, then in *Account Details* on the
      right, find **API Tokens** and click **Manage** → **Create API token**.

      That same *Account Details* panel is also where your **Account ID** is
      displayed — copy it while you're there.

      In the token form:
      - Choose **Account API token** (not *User API token*) — it belongs to the
        account rather than your personal login.
      - Permissions: **Object Read & Write**.
      - Under *Specify bucket(s)*, restrict it to `zahediportfolio`
        only. Don't leave it on all buckets.

      Copy the **Access Key ID** and **Secret Access Key** immediately —
      Cloudflare shows the secret once and never again. (It may label them
      *Client ID* / *Client Secret*.) You can ignore the S3 endpoint URL it
      shows; the publish script builds that itself from the Account ID.
- [x] **2.3** Bucket → **Settings** → **Custom Domains** → **Add**. Enter
      `media.zahedishams.com` → **Continue** → review the DNS record it proposes
      → **Connect Domain**. The zone from Stage 1 must already exist in this
      Cloudflare account or this step has nothing to attach to.
- [x] **2.4** Load any URL on `media.zahedishams.com` in a browser and confirm you
      get a Cloudflare 404 rather than a DNS error — that proves it's wired up.

      **Verified done (2026-09-16):** returns `HTTP/2 404` with
      `server: cloudflare`. The bucket is `zahediportfolio`, and the four
      credentials from 2.2 are loading correctly from `~/.zshrc`.
- [ ] **2.5** Hotlink protection — stop other sites from displaying your
      photos.

      **The problem.** Your images live at `media.zahedishams.com` and are
      publicly readable — they have to be, or your own site couldn't show
      them. Nothing stops someone else from putting
      `<img src="https://media.zahedishams.com/photography/...">` on *their*
      page. Their visitors see your photograph, and your bandwidth pays for
      it. That's hotlinking.

      **The fix.** When a browser loads an image, it tells the server which
      page asked for it. That's the `Referer` header. So:

      - Image requested by a page on **your** site → allow it.
      - Image requested by a page on **someone else's** site → block it.
      - Image requested by **no page at all** (someone pasted the URL
        straight into the address bar) → allow it.

      That third case is why the rule looks the way it does. Typing a media
      URL directly sends an *empty* Referer, which is indistinguishable from
      "no page." If you blocked empty referers too, you'd break your own
      ability to check a URL in a browser — and Stage 6.1 and 7.6 both ask
      you to do exactly that.

      **Where.** Select your domain → **Security rules** page →
      **Create rule** → **Custom rules**. Direct link:
      `https://dash.cloudflare.com/?to=/:account/:zone/security/security-rules`

      **What to enter.** Switch the rule builder to the expression editor and
      paste this, replacing nothing — this is your domain:
      ```
      (http.referer ne "" and not http.referer contains "zahedishams.com")
      ```
      Action: **Block**.

      Read aloud, that is: *"block this request if it names a referring page,
      and that page isn't on my domain."* Requests with no referer never match
      the first half, so they sail through.

      **Two dead ends, so you don't go looking.** Cache Rules and Transform
      Rules sound like they'd fit, but neither has a Block action — they only
      control caching and header rewriting. Scrape Shield's one-click Hotlink
      Protection toggle *does* block, but only for image content types, which
      would leave your video clips and press-kit PDF unprotected.

      **What this does and doesn't buy you.** It stops casual embedding on
      other websites, which is the common case. It does not stop anyone who
      genuinely wants your file: right-click-save still works, and a script
      that sends no referer, or forges yours, gets through. This is a
      deterrent, not a lock — which is the trade-off you chose at the start.

### 2.6 — Save the R2 credentials where your terminal can find them

You have four values from step 2.2: the Account ID, the Access Key ID, the
Secret Access Key, and your bucket name. The publish script reads them from
your terminal's environment. Putting them in `~/.zshrc` — the file zsh reads
each time you open a terminal — means you set them once and never again.

**Why not `.env`?** `.env` is for values the *website* needs, and its one
variable gets copied into Vercel at step 7.2. These four are **write**
credentials: anything holding them can overwrite or delete every file in your
bucket. The published site only ever reads images, so it must never carry
them. Keeping them out of `.env` means they can't be copied to Vercel by
habit. (`.env` is gitignored, so this isn't about GitHub — it's about the
deploy step.)

- [ ] **a.** Open the file in TextEdit:

```bash
touch ~/.zshrc && open -e ~/.zshrc
```

`touch` creates the file if you don't have one yet, and does nothing if you
do.

- [ ] **b.** Scroll to the very bottom and add these five lines. Replace each
  `...` with the real value — keep the quotes.

  **Type them into `~/.zshrc`, not into this file.** This document is tracked
  in git; `~/.zshrc` is not. A secret pasted here becomes part of the repo's
  history.

```bash
# Cloudflare R2 — local only. Never in .env, never in Vercel.
export R2_ACCOUNT_ID="..."
export R2_ACCESS_KEY_ID="..."
export R2_SECRET_ACCESS_KEY="..."
export R2_BUCKET_NAME="zahediportfolio"
```

No spaces around the `=`. `R2_ACCOUNT_ID = "abc"` does not work.

- [ ] **c.** Save (⌘S) and close TextEdit.

- [ ] **d.** Back in your terminal, load the file and check all four values
  arrived:

```bash
source ~/.zshrc
for v in R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET_NAME; do
  [ -n "${(P)v}" ] && echo "$v: set" || echo "$v: MISSING"
done
```

Four `set` lines means it worked. This prints only whether each value exists,
never the value itself, so it is safe to paste anywhere.

Do **not** use `printenv A B C` to check these: macOS ships the BSD version,
which accepts only one variable name and silently ignores the rest — it looks
like three of the four failed when all four are fine.

From now on every new terminal window has these automatically. The `source`
line is only needed for a window that was already open when you edited.

If you mistype the **secret**, you can't look it up — Cloudflare shows it
once. Delete that token in the dashboard and create a new one.

## Stage 3 — Point the code at your domain  *(two files, must match)*

> **Already done.** `zahedishams.com` happened to be the placeholder this
> project was built against, so both files already carry the right host and
> `npm run build` passes — which is the proof that they match. Steps 3.1–3.3
> are recorded here only so the pair is documented; there is nothing to
> change unless you switch domains.

- [x] **3.1** In `.env`, set `PUBLIC_MEDIA_BASE_URL=https://media.zahedishams.com`.
- [x] **3.2** In `vercel.json`, both `media.zahedishams.com` occurrences in
      the `Content-Security-Policy` line (`img-src` and `media-src`) use the
      same host.
- [x] **3.3** `npm run build` passes. It fails with an explicit error if 3.1
      and 3.2 disagree, so a green build proves they match.

---

## Stage 4 — Encode and upload your videos

### What the bucket looks like

Work is stored by category, so the bucket reads the way the site does:

```
zahediportfolio/
  work/
    commercial/     silent-sprint.mp4, silent-sprint-thumb/{640,1280,1920,2560}.{avif,webp}
    short-film/
    feature/
    documentary/
    music-video/
  photography/      neon-shadows/{640,1280,1920,2560}.{avif,webp}
  news/             <film>-poster/…
  about/            reel.mp4, portrait/…, hero/…, press-kit.pdf
```

Each image is its own folder of 8 objects — four widths in two formats — so a
browser downloads only the size it needs. Videos are single files.

**If you are re-uploading from an emptied bucket**, empty `work.json` to `[]`
first (it already is), then publish one category folder at a time: each run
recreates the entries for that category. Finish with `npm run check-media`,
which lists anything referenced but missing, or stored but unreferenced.

Videos live in the same R2 bucket as your photos. There is no video account
to create, nothing to pay for, and no other company involved: 3.5 GB of
masters encode to well under R2's 10 GB free allowance, and Cloudflare does
not charge for bandwidth.

One command does the whole job — it compresses the video, uploads it, and
writes the entry into `work.json` itself:

```bash
npm run publish-video -- work/<category> <project-slug> ~/Movies/your-video.mov
```

**The first argument is the folder in the bucket, and for work it names the
category too.** One of:

```
work/commercial   work/short-film   work/feature   work/documentary   work/music-video
```

That folder decides two things at once: where the file lives in R2
(`work/commercial/silent-sprint.mp4`) and which category the project is filed
under in `work.json`. A bare `work` is refused — an uncategorised project
would show no credits at all.

- [ ] **4.1** Publish **one** video first and check it plays on the site
      before doing the rest.
- [ ] **4.2** Publish the remaining project videos, one per project, from the
      folder matching its category.
- [ ] **4.3** Publish your reel — the reel is not a project, so it goes in
      `about`, not under a category:
      ```bash
      npm run publish-video -- about reel ~/Movies/reel.mov
      ```
      Then set `"reelVideoKey": "about/reel.mp4"` in `about.json`, or delete
      that line and `reelTitle` to hide the Play Reel button entirely.

**What to expect.** Encoding runs at roughly real time — a five-minute video
takes around five minutes, and the terminal shows ffmpeg's progress. Hand it
your best-quality export; the command makes the web version itself, so never
feed it something you already compressed.

**What it produces.** One 1080p file per video, which every viewer receives
regardless of screen or connection. There is no automatic quality switching
as there is on YouTube. In exchange there are no ads, no branding, no
tracking, and no monthly fee.

**On protection.** The player's download button is removed and right-click is
disabled, and the hotlink rule from step 2.5 stops other sites embedding your
videos. None of that stops someone who opens the browser's network panel and
copies the URL. That is the same deterrent-not-DRM trade you accepted for the
photographs.

## Stage 5 — Your content  *(done — work, photography, news are all uploaded)*

Kept as reference for adding more later. Each sub-step is independent; do them
in any order. **The site renders with whatever is done so far**, so you can go
one section at a time and re-check in `npm run dev`.

### 5.0 Publishing a whole folder at once

Rather than one file at a time:

```bash
npm run publish-folder -- photography ~/Pictures/portfolio
npm run publish-folder -- work/commercial ~/Movies/commercials
```

**One run per category.** Keep your masters in a folder per category on disk
and publish them one folder at a time — the destination decides both the
bucket folder and the category each new entry is filed under:

```bash
npm run publish-folder -- work/commercial   ~/Movies/commercials
npm run publish-folder -- work/short-film   ~/Movies/short-films
npm run publish-folder -- work/feature      ~/Movies/features
npm run publish-folder -- work/documentary  ~/Movies/documentaries
npm run publish-folder -- work/music-video  ~/Movies/music-videos
```

It takes every image (or video) in the folder, names each one from its
filename — `Neon Shadows.jpg` becomes `neon-shadows` — publishes it, and
writes the content file. Videos are done one at a time, because encoding uses
the whole processor and doing several at once is slower, not faster.

- **Already-published files are skipped**, so you can drop a few new photos in
  and re-run without waiting through the rest. `--force` redoes them anyway.
- **One failure does not abandon the batch.** The rest continue and the
  failures are listed at the end; re-running retries only those.
- **It refuses to start if two filenames would collide** — `Shot 1.jpg` and
  `shot-1.jpg` both become `shot-1` — and names the pair, rather than
  silently overwriting one with the other.

Filenames become URLs, so name files the way you want them to read.
Start with two or three files to see the shape of the output.

### 5.0b Publishing one file at a time

Same arguments, except you name the slug yourself instead of it coming from
the filename:

```bash
npm run publish-image -- <folder> <slug> <path-to-file>
npm run publish-video -- <folder> <slug> <path-to-file>
```

```bash
npm run publish-image -- photography neon-shadows ~/Pictures/DSC_0042.jpg
npm run publish-image -- work/commercial pran-milk-thumb ~/Desktop/frame.png
npm run publish-image -- about portrait ~/Pictures/portrait.jpg
npm run publish-video -- work/music-video kingbodonti ~/Movies/kingbodonti.mov
```

Use this to re-publish a single file — replacing one thumbnail, swapping the
portrait — or to add one project without putting it in a folder first.
`publish-folder` just runs these two for you, so the result is identical.

Run it with no arguments to be reminded of the argument order:

```bash
npm run publish-image
```

### 5.1 Photographs — `src/content/photography.json`

- [ ] Each photo becomes its own folder of 8 objects — four widths in two
      formats, so a browser downloads only the size it needs. For each photo,
      run:
      ```bash
      npm run publish-image -- photography <slug> ./path/to/photo.jpg
      ```
      Hand it the **full-resolution original** — the script downsamples. Never
      give it a pre-shrunk copy.
- [ ] Nothing to paste — the command writes `photography.json` itself,
      including the `widths` list that says which sizes exist. Fill in the
      caption, location and year it leaves blank.
- [x] Do the first one alone and verify it before batching the rest.
      **Done 2026-09-16** — `test-shot` published and served correctly, so the
      whole pipeline is proven. Batch the rest with confidence.

### 5.2 Projects — `src/content/work.json`

`work.json` starts empty. Each `publish-video` / `publish-folder` run adds the
projects it publishes, with that category's credit fields blank for you to
fill in.

- [ ] **The credit block depends on the category.** Every project shows its
      title, category and year; what sits between them is the category's own:

      | Category | Credits shown |
      |---|---|
      | `commercial` | client, director |
      | `short-film` | director, producer, run time |
      | `feature` | director, producer, run time |
      | `documentary` | — nothing beyond title, category, year |
      | `music-video` | artist, director |

      Those rows always appear for that category, blank where you have not
      filled them in. A field belonging to another category is never shown —
      a client typed onto a music video stays in the file and stays hidden.
- [ ] **Every field except `slug` and `videoKey` is optional.** A missing one
      renders blank; it will not fail the build or stop the dev server.
- [ ] `runtime` is free text, written exactly as you want it to read:
      `"18 min"`, `"1 h 52 min"`.
- [ ] `category` is one of the five above, and is set for you from the folder
      you published from. Anything else fails the build with the list of valid
      values. A project with no `category` at all is fine — it appears under
      **All**, under no category button, and shows no credits but its year.
- [ ] The filter bar shows all five categories always. One with no projects
      yet is **dimmed and disabled**, so the range of work reads even before
      it is filled in. Add a project to that category and its button comes
      alive on the next build — nothing to switch on.
- [ ] To add a sixth category, or to change which credits a category shows,
      edit `WORK_CATEGORIES` in `shared/work-categories.mjs`. The schema's
      valid values, the filter bar, the viewer's rows and the fields a newly
      published project is seeded with all come from that one list.
- [ ] `videoKey` — written for you by `publish-video`, e.g.
      `work/commercial/silent-sprint.mp4`. If no project has that slug yet, it
      creates one, with a placeholder title from the slug, the current year,
      the category you published from, and that category's credits blank.
- [ ] Thumbnail: **nothing to do** — `publish-video` grabs a frame a third of
      the way into the video, publishes it beside the video, and writes
      `thumbnailKey` into `work.json` for you. To choose your own frame,
      export a still and run
      `npm run publish-image -- work/<category> <slug>-thumb ./still.jpg`,
      which overwrites it.
- [ ] Hover clip: a short silent `.mp4`, uploaded to R2 by hand (drag into the
      bucket, into that category's folder), then
      `hoverPreviewKey: "work/<category>/<slug>-preview.mp4"` — **with the
      extension.**

### 5.3 About — `src/content/about.json`

- [ ] Real bio, `representation` entries, `directInquiryEmail`, `location`.
- [ ] `reelVideoKey` and `reelTitle` from step 4.3 — **or delete both** to
      hide the "Play Reel" button entirely.
- [ ] Portrait: `npm run publish-image -- about portrait ~/path/to/photo.jpg`.
      It writes `about.json` itself; set `portraitAlt` by hand. The portrait
      displays up to about 768px wide on a Retina screen, so give it an
      original of at least 1280px.
- [ ] Landing-page background — a **photo** or a **video**:
      - Photo: `npm run publish-image -- about hero ~/path/to/photo.jpg`.
        It writes `about.json` itself, including the width list when your
        original is under 2560px wide. A photo wins over a video if both are
        set.
      - Video: a silent `.mp4` uploaded by hand, `heroLoopKey` **with** the
        extension.
- [ ] Press kit PDF (optional): upload by hand and add `pressKitKey` with its
      extension. With no `pressKitKey`, no download button renders.
- [ ] Footer social links — add a `socials` array. Omit it and the footer shows
      no social links at all, which is fine:
      ```json
      "socials": [
        { "label": "Instagram", "url": "https://instagram.com/yourhandle" },
        { "label": "Vimeo", "url": "https://vimeo.com/yourhandle" },
        { "label": "IMDb", "url": "https://imdb.com/name/nm0000000/" }
      ]
      ```
      URLs must be absolute — the build rejects `#` or a bare handle.

### 5.4 News & Press — `src/content/recognition.json` and `news.json`

The section is built around **one featured film**: its poster, the awards it
won and the nominations it received. Below that sits the press list.

- [ ] Publish the film's poster — folder first, then slug, then the file:
      ```
      npm run publish-image -- news <slug>-poster ~/path/to/poster.jpg
      ```
      Quote the path if it contains spaces. Only the poster is uploaded; the
      film itself is not hosted here. The script writes `posterKey` and
      `posterWidths` into `recognition.json` for you, creating the `film`
      block if it isn't there yet.
- [ ] `src/content/recognition.json` → `site.film`: fill in `title`, `year`,
      `posterAlt`, and optionally `role` (your credit on the film) and
      `logline`. The script guesses a title and alt text from the slug —
      replace them.
- [ ] `site.accolades` — one entry per award, nomination **or** festival
      selection, all in the same list. `result` is `"win"`, `"nomination"` or
      `"selection"`; the site splits them under **Awards**, **Nominations**
      and **Official Selections** headings and sorts each newest first. Use
      `"selection"` for being chosen to screen — an official selection, a
      final selection, an opening-night slot — which is not the same claim as
      being shortlisted for an award:
      ```json
      { "result": "win", "title": "Best Cinematography",
        "org": "Mari International Ethnic Film Festival", "year": 2026 }
      { "result": "selection", "title": "Opening Film",
        "org": "Clapham International Film Festival", "year": 2025 }
      ```
- [ ] `src/content/news.json` — press and podcast items only, now that awards
      live above. Per item: `type` (`press` / `podcast`), year, title, org,
      optional `project`, optional `link`. Leave the array empty (`[]`) and the
      Press column simply doesn't render.

Every part degrades on its own: no `film` block, no poster row; no accolades,
no Awards/Nominations headings; an empty `news.json`, no Press column.

### 5.5 Site-wide

- [ ] Favicon into `public/`.
- [ ] Optional Open Graph image for link previews, referenced from
      `src/layouts/BaseLayout.astro`.
- [ ] Decide on fonts: the site ships a free stand-in pairing (Cormorant
      Garamond + Inter). Either sign off on it or supply licensed files.

### Key shapes — the most common mistake

| Field | Shape | Example |
|---|---|---|
| `thumbnailKey`, `imageKey`, `portraitKey`, `heroImageKey` | **no** extension | `work/commercial/silent-sprint-thumb` |
| `hoverPreviewKey`, `heroLoopKey`, `pressKitKey`, `videoKey`, `reelVideoKey` | **with** extension | `work/commercial/silent-sprint-preview.mp4` |

Rule of thumb: if `publish-image` made it, no extension. If you dragged the
file into the bucket yourself, keep its extension. The build rejects the wrong
shape now, so you'll be told rather than silently getting 404s.

---

## A field you added to the JSON does not show up

If you add a value to a content file and the page keeps showing it blank,
**restart the dev server** (Ctrl-C in its terminal, then `npm run dev`).

Astro caches parsed content in `.astro/data-store.json`, and the schema
strips any key it does not know about. So when a *new* field is added to
`src/content/schemas.ts` — `client` was the first — a dev server started
before that change carries on serving entries parsed under the old schema,
with the new field dropped. Astro clears that cache when
`src/content/config.ts` changes, but the schemas live in their own file
which `config.ts` imports, and that indirect change does not trigger it.

Telling this apart from a real bug takes one command: `npm run build` and
grep the output. A fresh build always reparses, so if the value is in
`dist/index.html` the content and code are fine and only the running server
is stale.

---

## Replacing an asset that is already published

Re-publishing writes the same keys, so nothing has to be deleted first:

```
npm run publish-image -- work/<category> <slug>-thumb ~/path/to/better-thumb.jpg
```

Use the category the project is filed under, so the new thumbnail lands beside
its video. The slug must be the project's slug in `work.json` with `-thumb` on
the end — the script strips that suffix to find the entry, and refuses with a
list of real slugs if it matches none. It overwrites the eight derivatives and
rewrites `thumbnailKey` / `thumbnailWidths`.

**Then purge the CDN cache, or you will keep seeing the old image.** Objects
are served with `cache-control: max-age=14400` (Cloudflare's default for an R2
custom domain, since the upload sets no header of its own), so the edge and
every browser that has already loaded the page hold the previous file for up
to four hours. Overwriting the object does not invalidate that.

Cloudflare dashboard → your domain → **Caching** → **Configuration** →
**Purge Cache** → **Custom Purge** → purge by **Prefix**, one line per
thumbnail:

```
media.zahedishams.com/work/<category>/<slug>-thumb
```

A prefix clears all eight derivatives at once. Purge by prefix is available on
every plan (it was Enterprise-only until recently), 100 prefixes per request.
Purging everything works too and is harmless here — the bucket is small and it
just re-fills from R2.

Two things to know when the replacement differs from the original:

- A **smaller** source produces fewer derivative widths, because images are
  never enlarged. `thumbnailWidths` shrinks to match, and the wider files from
  the previous version stay in the bucket unreferenced — `npm run check-media`
  lists them under *Orphaned*.
- Nothing else in the entry is touched: title, credits and `videoKey` survive
  a re-publish.

Do not use `publish-folder --force` for this. It re-encodes every video in the
folder to replace thumbnails you could have replaced one at a time.

---

## Stage 5.6 — Check the content against the bucket

Run this whenever an image or video goes missing, and once before deploying:

```
npm run check-media
```

It lists every R2 object the JSON files reference and compares it with what
is actually in the bucket, then prints:

- **MISSING** — referenced but not there, grouped by which entry asked for
  it. This is what a broken thumbnail or a dead Play Reel button looks like
  from the outside. Either re-publish the source file or remove the entry.
- **Orphaned** — in the bucket but referenced by nothing. Harmless; you are
  just paying to store them.

It exits non-zero when anything is missing. Note it needs the R2 credentials
in your shell, so it runs locally only — never in a deploy.

---

## Stage 6 — Browser QA  *(the content is in; this is the last gate)*

`npm run check-media` proves the keys resolve. It cannot tell you the site
*feels* right — that needs eyes. Run `npm run dev` with DevTools open.

- [ ] **6.1** Network tab filtered to your media domain: **zero 404s.** A 404
      is almost always a key-shape mistake from the table above. `check-media`
      catches these before the browser does.
- [ ] **6.2** Header: name large and centred on the hero, shrinking into the
      top bar as you scroll, nav growing the opposite way. One clean
      transition, reversing on the way back up.
- [ ] **6.3** Open a photo lightbox, scroll — the page behind must not move.
      Close it, you're where you were. Repeat with a project video.
- [ ] **6.4** Photo wall: three rows deep, arrows appear at each end and
      disappear at the extremes, tiles lift under the cursor without the
      arrows disappearing behind them.
- [ ] **6.5** Escape closes the video lightbox **and the audio stops.** Listen
      for this specifically.
- [ ] **6.6** Project panel slides open under the row it belongs to, pushes
      only the rows below, and the credit block shows the right fields for
      that category (commercials: client, director — no producer).
- [ ] **6.7** Every nav link and "Back to top" lands with the heading clear of
      the fixed header, and the highlighted nav item matches the section
      you're actually looking at.
- [ ] **6.8** Category filter: every button with work behind it filters; the
      empty ones are dimmed and do nothing.
- [ ] **6.9** Phone at 390px and 360px: no sideways scroll, menu button opens
      the full-screen panel, a link both closes it and scrolls, the X closes
      it. Photo wall not clipped by the address bar.
- [ ] **6.10** Contact links work from a phone: the WhatsApp number opens
      WhatsApp, the footer email button opens a mail client.
- [ ] **6.11** With OS reduced-motion on, reveals and the skeleton shimmer are
      off and nothing is left invisible.
- [ ] **6.12** Visit a URL that does not exist (`/nope`) — the 404 page should
      show a photograph and links back in.
- [ ] **6.13** Tune the collage: `targetWidthFor` and `rowSpanFor` in
      `src/scripts/photo-wall-layout.ts` /
      `src/components/sections/PhotographySection.astro` decide how many
      photos stack per column. Only worth touching if the rhythm looks wrong
      with your real set.

### 6.14 Things still outstanding in the content

- [ ] **Favicon.** `public/` is empty, so the browser tab shows Astro's
      default. Drop a `favicon.svg` (or `.ico`) in `public/` and reference it
      from `src/layouts/BaseLayout.astro`.
- [ ] **Showreel.** `reelVideoKey` is unset, so no "Play Reel" button renders
      on the hero. Publish one with
      `npm run publish-video -- about reel ~/Movies/reel.mov` if you want it.
- [ ] **Press kit.** `pressKitKey` is unset, so no download button renders.
      Add the key back to `about.json` once the PDF is in the bucket.
- [ ] **Open Graph image** for link previews, referenced from `BaseLayout`.
      Without one, a shared link shows a blank card.

---

## Stage 7 — Deploy

Seven commands, roughly 15 minutes, most of it waiting for DNS. Do them in
order — each one depends on the last.

### Before you start

```bash
npm test && npm run build && npm run check-media
```

All three must pass. `check-media` needs your R2 credentials in the shell, so
run it from the same terminal you publish from. If the build fails here it
will fail on Vercel too, and Vercel's logs are slower to read than your own.

---

### 7.1 Install the CLI and link the project

```bash
npm i -D vercel
npx vercel login
npx vercel link
```

`-D` matters: as a plain dependency Vercel reinstalls the whole CLI on every
build. The install prints a wall of deprecation warnings and an audit count —
all of it from the CLI's own dependency tree, none of it in anything a visitor
loads. **Do not run `npm audit fix --force`**; it rewrites versions across the
tree, Astro included.

`vercel link` is interactive and the exact questions depend on your account —
it only asks about scope if you belong to more than one team, so on a personal
account it skips that. What it always needs from you:

- **Set up "~/Documents/Zahedi Portfolio"?** → yes.
- **Link to an existing project?** → no, the first time. There is nothing to
  link to yet.
- **Project name** → `zahedi-portfolio`. **Lowercase only** — letters,
  digits, `.`, `_`, `-`. A capital letter is rejected, but only after you have
  answered every other prompt, and then the whole command aborts. It becomes
  the default `*.vercel.app` subdomain; your real domain gets attached in 7.5
  either way.
- **In which directory is your code located?** → `./` — press Enter to take
  it. This is the root of the repo, where `package.json` and `astro.config.mjs`
  are. It is asking because a monorepo would keep the site in a subfolder;
  this one does not.

It writes `.vercel/` in the project. That folder is gitignored and holds the
project id — keep it, or the next deploy creates a second project.

If a prompt appears that isn't listed here, the default is almost always
right. Take it.

**It will say "No framework detected"** and offer `public` or `.` as the
output directory. Ignore it — answer **no** to *Customize settings* and let
the project be created with whatever defaults it likes.

`vercel.json` already overrides all of it:

```json
"framework": "astro",
"buildCommand": "npm run build",
"outputDirectory": "dist"
```

That file wins over the project's dashboard settings on every build, and it
is in git, so it cannot be lost or mis-clicked. Without it the deploy would
publish `public/` — which is empty — instead of `dist/`.

Confirm what the project ended up with:

```bash
npx vercel project inspect zahedi-portfolio
```

It will still print *Framework Preset: Other*. That is fine; `vercel.json`
takes precedence at build time, and 7.3 verifies the real result on a preview
URL before anything reaches your domain.

### 7.2 Give the build its one environment variable

The site needs `PUBLIC_MEDIA_BASE_URL` at build time to construct every image
and video URL. Without it the build fails.

```bash
npx vercel env add PUBLIC_MEDIA_BASE_URL production --no-sensitive
```

It prompts for the value. Paste exactly what `.env` has:

```
https://media.zahedishams.com
```

No trailing slash. Repeat with `preview` in place of `production` if you want
preview deploys to show media too.

`--no-sensitive` matters here. Vercel now marks production variables
*sensitive* by default, which means you can never read the value back — not
in the dashboard, not from the CLI. That is right for an API key and wrong
for this: it is a public URL that appears in the page source of every visitor,
and one typo in it breaks every image on the site. Keep it readable so you
can check it.

Check it took:

```bash
npx vercel env ls
```

> **Never add `R2_ACCESS_KEY_ID` or `R2_SECRET_ACCESS_KEY` here.** Those are
> write credentials for your bucket. The deployed site only ever reads media
> over HTTPS from the public domain — it has no reason to hold a key that can
> overwrite it. They belong in your local shell and nowhere else.

Environment variables apply to *new* deployments only. Add one after
deploying and nothing changes until you deploy again.

### 7.3 Deploy to a preview URL first

```bash
npx vercel
```

No `--prod`. This builds and deploys to a throwaway URL like
`zahedi-portfolio-abc123.vercel.app`, printed at the end.

**Expect every image to be missing on this URL, and do not treat that as a
failure.** The hotlink rule from Stage 2 only trusts a `Referer` containing
`zahedishams.com`, so the media domain answers a `*.vercel.app` page with 403
on every file. That is the rule working.

What this URL *does* prove: the build ran, `dist` shipped rather than the
empty `public/`, and the security headers arrive. Check the page structure is
there — sections, project cards, captions — and leave the media for 7.6, once
the real domain is attached.

The `.vercel.app` URL is also SSO-gated on a team account
(`ssoProtection: all_except_custom_domains`), so only someone logged into your
team can open it. Your custom domain is exempt — that is what the setting
means. To fetch it from a terminal, use the CLI's authenticated fetch:

```bash
npx vercel curl https://<your-deployment>.vercel.app | head -40
```

If the build fails, read the log it links to. The two likely causes:

- `PUBLIC_MEDIA_BASE_URL is not defined` — 7.2 didn't take, or you set it for
  `preview` only and this is a production build.
- A CSP/media-origin mismatch — `astro.config.mjs` fails the build on purpose
  when `vercel.json`'s CSP and `PUBLIC_MEDIA_BASE_URL` name different origins.
  Fix `vercel.json`, commit, deploy again.

### 7.4 Promote to production

```bash
npx vercel --prod
```

Same build, this time it becomes the live deployment.

### 7.5 Attach your domain

```bash
npx vercel domains add zahedishams.com zahedi-portfolio
npx vercel domains add www.zahedishams.com zahedi-portfolio
```

The second argument is the project name from 7.1 — without it the domain is
added to your account but attached to nothing.

Vercel prints the DNS records it wants. **Your DNS is on Cloudflare** (Stage
1), so add them in the Cloudflare dashboard → your zone → **DNS** → **Add
record** — not at your registrar.

Set each record's proxy status to **DNS only** (grey cloud, not orange).
Proxying Vercel through Cloudflare puts two CDNs in series and breaks
certificate issuance.

Then wait, and check with:

```bash
npx vercel domains verify zahedishams.com
```

It reports what DNS currently says versus what Vercel expects, so a typo in a
record shows up as a mismatch rather than as silence. Usually a few minutes.

### 7.6 Verify the security headers arrived

The test suite checks `vercel.json`'s shape, not the live response. Confirm
the headers are actually served:

```bash
curl -sI https://zahedishams.com | grep -iE "content-security-policy|x-frame|x-content-type|referrer"
```

You should get four lines. Nothing back means `vercel.json` didn't ship —
check it is committed and redeploy.

### 7.7 Verify hotlink protection

The Cloudflare rule from Stage 2 should let your own site load media and block
everyone else. Test both directions:

```bash
# Your own site — expect 200
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Referer: https://zahedishams.com/" \
  https://media.zahedishams.com/about/portrait/1280.webp

# Someone else's site — expect 403
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Referer: https://example.com/" \
  https://media.zahedishams.com/about/portrait/1280.webp
```

If the second returns 200, the WAF rule isn't active — re-check Stage 2.4.

### 7.8 Last look on a real phone

Open the live URL on your own phone, not the simulator. Check the things a
desktop browser cannot tell you:

- [ ] A project video plays with sound, and stops when you close the panel.
- [ ] The photo wall scrolls sideways by touch without dragging the page.
- [ ] The menu button opens, a link closes it and scrolls.
- [ ] The WhatsApp link opens WhatsApp with your number filled in.
- [ ] iOS Safari: the photo wall isn't clipped by the address bar appearing
      and disappearing as you scroll.

---

## After launch

**Deploying a change.** Any content edit or code change:

```bash
npm test && npm run build     # catch it locally first
npx vercel --prod
```

**Optional: deploy on push.** Push this repo to GitHub, then Vercel dashboard
→ your project → **Settings** → **Git** → connect the repository. After that
every push to `main` deploys on its own and `npx vercel --prod` becomes
unnecessary. There is no remote configured right now, so this is a later
choice, not a prerequisite.

**Rolling back.** Vercel dashboard → **Deployments** → find the last good one
→ **⋯** → **Promote to Production**. Instant, and it does not rebuild.

**After replacing any media**, purge the Cloudflare cache for that prefix or
the old file keeps being served for up to four hours — see *Replacing an asset
that is already published* above.

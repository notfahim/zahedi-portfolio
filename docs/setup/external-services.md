# External Services Setup

What to set up outside this repo before the site can go live, and which
env vars each step produces.

## 1. Cloudflare R2 (image/video/PDF storage)

1. Cloudflare dashboard → R2 → Create bucket (e.g. `zahediportfolio`).
2. **Storage & databases → R2 → Overview**, then in the **Account Details**
   panel on the right: **API Tokens → Manage → Create API token**. (It is
   not on the bucket's own page.) Choose **Account API token**, permission
   **Object Read & Write**, and under *Specify bucket(s)* restrict it to
   that one bucket. Note the **Access Key ID** and **Secret Access Key** —
   the secret is shown only once — plus the **Account ID**, which is in
   that same Account Details panel.
3. R2 → your bucket → **Settings** → **Custom Domains** → **Add** → enter
   e.g. `media.zahedishams.com` → **Continue** → review the proposed DNS
   record → **Connect Domain**. Requires that domain's zone to already exist
   in this Cloudflare account (a partial/CNAME setup also works).
4. Hotlink protection: select the domain, then go to the **Security rules**
   page → **Create rule** → **Custom rules**. (Cloudflare reorganised this
   area into a single security dashboard; the old *Security → WAF → Custom
   rules* path no longer matches the UI. Direct link:
   `https://dash.cloudflare.com/?to=/:account/:zone/security/security-rules`.)
   Block requests whose `Referer` is set and doesn't contain your real
   domain:
   `(http.referer ne "" and not http.referer contains "zahedishams.com")`
   with the action set to **Block**. Leave the empty-referer case
   unblocked — as that expression does — so direct navigation to a media
   URL still works.
   Note: it must be a custom rule. Cache Rules and Transform Rules cannot do
   this — they control cache behavior and URL/header rewriting respectively,
   and neither offers a Block action. Cloudflare's Scrape Shield → Hotlink
   Protection toggle is a simpler alternative but covers image content types
   only, so it would leave the R2-hosted video clips and the press-kit PDF
   unprotected.
5. Record for local use (Task 15's CLI reads these from your shell
   environment, NOT from `.env` — they must never be committed or
   deployed):
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_NAME`
   - `PUBLIC_MEDIA_BASE_URL` (e.g. `https://media.zahedishams.com`) — this
     one DOES go in `.env` (see `.env.example`) and in Vercel (step 2.2),
     since the deployed site reads it at build time to construct URLs.

## 2. Vercel

1. `npm i vercel` then `npx vercel link` (or import the git repo from the
   Vercel dashboard) to create the project. Vercel documents a local install
   rather than a global `-g` one.
2. Project → **Environment Variables** in the sidebar → add
   `PUBLIC_MEDIA_BASE_URL`, scoped to Production (and Preview if wanted).
   This is the only env var the deployed site needs — the R2 write
   credentials from step 1.5 are used only by the local publish script and
   must never be added here. Env vars apply to new deployments only, so
   redeploy after adding.
3. Deploy once Task 16 is complete: `npx vercel --prod`.

## 3. Video hosting — none needed

Videos are self-hosted in the R2 bucket from §1, encoded locally by
`npm run publish-video` (which needs `ffmpeg`: `brew install ffmpeg`).

Project videos are stored by category — `work/commercial/`, `work/short-film/`,
`work/feature/`, `work/documentary/`, `work/music-video/` — and the folder you
publish from is also the category the project is filed under. The showreel
lives in `about/`. Full instructions in `go-live-steps.md` Stage 4.

There is no video account to create. This replaces an earlier plan to use
Vimeo, which was abandoned once its Free plan turned out to cap an account at
1 GB for its lifetime — see §8 of the design spec for the full reasoning and
the trade-offs accepted (one quality for all viewers; the file is
downloadable by anyone who looks for the URL).

## 4. DNS

- `media.zahedishams.com` is created automatically by the R2 custom-domain
  connection (step 1.3).
- Point your apex/`www` domain at Vercel per Project → **Domains**. Because
  the zone is on Cloudflare, add the records Vercel gives you in the
  Cloudflare zone rather than at your registrar.

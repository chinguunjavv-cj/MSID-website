# Handover — 9 August 2026

The site went **public** today: https://msidwebsite.vercel.app (Vercel project
`msid_website`). Chinguun switched off Vercel Authentication and deleted the broken
duplicate project `msid-website` (hyphen) — if a hyphenated URL 404s with
DEPLOYMENT_NOT_FOUND, that is the deleted duplicate, not a database problem. Everything
is committed and pushed; `main` == `origin/main` at `c186903`, typecheck clean, live
pages error-free in both locales.

---

## Do this first: the production content sync is READY but NOT RUN

Production Turso is missing content that exists locally. The four commands are written,
verified against the production schema, idempotent, and sitting in the transcript with
Run buttons. The auto-mode classifier blocks Claude from running them (production
writes); **Chinguun runs them himself**, or approves each prompt.

They are, in order:

1. `import-events.mts` with three `--cover` flags — creates the missing
   **taiwan-mongolia-ibd-2024** event and replaces both mis-cropped covers
   (AOCC: sky removed; DDWeek: ceiling removed — both re-cut from originals in
   `fwdhi/`, anchored to the bottom edge so nobody loses their feet)
2. `import-event-photos.mts --event taiwan-mongolia-ibd-2024` — 3 photos + alts
3. `import-event-photos.mts --event ddweek-2024-ibd` — 3 photos incl. the
   endoscopy-room group photo
4. `import-partner-logos.mts` — KASID / AOCC / ECCO to Blob + `partners.logo`

After those: the **mission-page photo has no script** — set `pages.image` +
`image_alt_mn/en` for `about.mission` via storeFile (the local values to copy are in the
local DB). Then hard-reload (`Cmd+Shift+R`) before judging.

All sources live in `public/uploads/` locally; `.env.production.local` now holds **real**
Turso + Blob credentials (Chinguun pasted them 9 Aug; file is gitignored).

### Trap that already bit once
`db()` **bootstraps an admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD` on connect.** With the
redacted env file those were the literal string `[SENSITIVE]`, so the first production
connection created a live admin with a guessable password. It was deleted within minutes
and the `ADMIN_*` lines are commented out — do not uncomment them with placeholder
values. Real admins: chinguunjavv@gmail.com, admin@msid.mn.

---

## What shipped today (all on main)

- **`5d67310`** — membership section back on the landing page (Restrained language, not
  the old copper band); `pages.image` + bilingual alt (migration `2026-08-09-page-image`,
  auto-applies — already applied to prod by the live site); partner logos cropped +
  background-flooded in `public/brand/`; three dev-server warnings fixed; demo seeder no
  longer invents board members and dates content backwards from today; guidelines-audit
  fixes (`aria-haspopup`, spellcheck off on email/password, placeholder ellipsis)
- **`41ae276`** (Chinguun's parallel session) — membership section now yields to news
  *automatically*: it renders only while `news.length === 0`, and its heading no longer
  repeats its own button
- **`c186903`** — the reading measure is **76ch** site-wide (was 68ch prose / 62ch
  summaries / 896px register). Chinguun looked at the live site on a wide screen and
  said, three pages running, "extend the text and content" — treat the wider measure as
  settled. Registers run the full shell; event covers max-w-5xl.

Web Interface Guidelines audit passed otherwise — the one deliberate deviation is
hand-rolled dates (Mongolian ordinal particle дугаар/дүгээр needs vowel harmony that
`Intl` can't do; documented in `src/lib/format.ts`).

## The code/content split — explain it before it confuses again

Chinguun saw the filled test site, then the empty production site, and asked why.
**Code travels through git; content lives in each environment's own database.**
Everything added to the local DB (demo content, photos) stays local. `npm run demo` /
`npm run demo:clear` manage the local placeholder content — 5 news, 4 publications,
5 guidelines, 7 events. **Never run `demo.mts` against production.**

## Open work, in order

1. **Run the sync** (above), then verify the live site shows logos, carousel, mission
   photo
2. **Admin audit** (task #5) — queued findings: `publications.cover_image` is uploadable
   but rendered nowhere; settings ask the admin to hand-paste an uploads path for a hero
   image that no longer exists; news/event covers show only on detail pages, never lists
3. **Orphaned uploads** (task #6) — nothing ever deletes a stored file; the `uploads`
   table is written and never read; import scripts bypass it entirely. On Blob that is
   billed storage. Two orphaned cover blobs will be created by step 1's cover replacement.
4. **Preview env shares the production database** — previews are now public;
   `TURSO_*` + Blob are scoped "Production, Preview". Point Preview at its own DB or
   remove the vars so previews fail loudly.
5. **Domain day** (task #8) — add domain, set `MSID_SITE_URL`, `MSID_NOINDEX=0`. The
   noindex flip is env-driven (`robots.ts` is force-dynamic); NOT a robots.txt edit.
   Until then the site stays unindexed — Chinguun's explicit decision.

## Traps

- **`curl` 200 ≠ working.** Next serves the error boundary with a 200; grep for
  `"digest":"` in the HTML. This found production down (`ENOENT mkdir './data'`) while
  every status probe said fine.
- Vercel env vars are **sensitive/write-only** — `vercel env pull` yields `[SENSITIVE]`.
  Real values came from the Turso/Vercel dashboards, via Chinguun.
- **Two sessions run on this repo simultaneously** (dev server now takes any free port —
  `1977be9`). Check `git log` before assuming HEAD is where you left it.
- The Browser pane's console reader replays a stale buffer after edits; trust server-side
  HTML checks over remembered console errors.
- DESIGN.md is still stale (pre-Restrained). Rewriting it remains the highest-value
  cleanup. PRODUCT.md also still describes the guidelines register as the primary
  landing-page job.

# Handover

Written 4 August 2026, at commit `92d296e`. Working tree clean, `main` in sync with
`origin/main`, Vercel deploys `main` automatically.

This is the state of the work and the things that are not written down anywhere else.
For the ordered list of what still has to happen before launch, read
[LAUNCH.md](LAUNCH.md); for the security and quality findings, [AUDIT.md](AUDIT.md).
This document does not repeat either.

---

## Where things stand

The site is live at `msidwebsite.vercel.app`, running on Vercel with a Turso database and
Vercel Blob for uploads. It is **deliberately hidden from search engines** and should stay
that way until it has a real domain — see "Going public" below.

MSID has now supplied real content, and it is in production: sixteen board members, the
President's greeting, the ulcerative colitis guideline (ЭМС-ын тушаал А/703), the reduced
50,000₮ membership fee, and photographs. The invented placeholder content that the earlier
notes worried about is gone from production — though see the next section for a surprise
about what production actually contained.

**Production never had the demo records.** The demo rows (`demo-msid-congress`,
`demo-endoscopy-course`, `demo-news-congress-open`) only ever existed on the local
machine. When the production database was first inspected during the deploy it held the
seeded skeleton — 11 pages, 21 settings, 3 partners, 1 history entry, 1 admin user — and
**zero** board members, events, guidelines or news. So the content import was purely
additive, and LAUNCH.md's "delete or archive the demo records" step does not apply to
production. It still applies to any local database that has had `npm run demo` run
against it.

---

## Do this first: rotate two credentials

To run the production imports, these were pasted into a chat session on 4 August 2026:

- the **Turso auth token** for `database-chestnut-marble-vercel-…`
- the **Vercel Blob read-write token** `vercel_blob_rw_8aRqNP4nEWmg8bAx_…`

They were never written to a file in this repository and are not in git history. They
have still left the machine they belong on, so treat them as exposed and rotate both:
Vercel → Storage → the store → rotate the token → update the environment variable →
redeploy. The Turso token can also be rotated from the Turso dashboard or `turso db
tokens invalidate`.

Nothing breaks while they are rotated; the imports are re-runnable.

The Gmail app password for `ibdmsid@gmail.com` has **not** been created yet, and when it
is, MSID should paste it straight into Vercel. It should not be sent through chat, and it
does not belong in this repository.

---

## Content is imported by script, not typed into the admin

This is the single most important convention to preserve, and it is easy to break by
accident because the admin interface works perfectly well.

The 50,000₮ membership fee was originally a hand-edit against the local database. That
meant it existed on one laptop and nowhere else, and would have been discovered missing
the first time somebody compared the live site to what MSID had been told. It is now in
`import-assets.mts`, guarded so a re-run does not append it twice.

Three scripts own the content MSID supplied, and each is idempotent, so a correction is
just a re-run:

| Script | Owns | Takes |
| --- | --- | --- |
| `npm run import:board` | The sixteen board members | `--photo "Name En=/path.jpg"`, repeatable |
| `npm run import:assets` | President's greeting, membership fee, UC guideline | `--guideline "/path.pdf"` |
| `npm run import:events` | The three past events and their covers | `--aocc`, `--ddweek`, `--taiwan` |

They resize images themselves via `scripts/lib/store-file.mts` (sharp — portraits to
960×1200, covers to 1600×900), so they take the **original** file MSID sent. That is
deliberate: a pre-resized copy in a temp directory will not exist the next time these run.

To run any of them against production, export the three variables first — without
`BLOB_READ_WRITE_TOKEN` the photographs are written to a local disk Vercel cannot read
and the database ends up holding `/uploads/…` paths that resolve to nothing:

```bash
export TURSO_DATABASE_URL='libsql://…'
export TURSO_AUTH_TOKEN='…'
export BLOB_READ_WRITE_TOKEN='vercel_blob_rw_…'
```

**One import has not been run against production yet.** The Taiwan–Mongolian conference
was added in `92d296e` but the live database does not have it:

```bash
npm run import:events -- --taiwan "/Users/chinbold/Downloads/fwdhi/IMG_1519.jpg"
```

---

## The rule the content follows

Nothing on this site is inferred. Every fact came from a document MSID sent, a banner in
a photograph, or a slide on a screen — and where a detail could not be read, the field
was left empty rather than filled with something plausible. This is a clinical standards
body's public record; a confidently wrong date is worse than a missing one.

Three examples, so the rule is concrete rather than decorative:

- **Board term dates were removed.** They had been derived from the founding date, which
  is a guess wearing a fact's clothes. A date printed under a real person's name should
  be one somebody supplied.
- **The DDWeek venue is blank.** The photograph identified the session and the date; it
  did not identify the hall.
- **The whole Taiwan event came off a banner.** Title, three session topics, date, hours
  and floor are all printed in `IMG_1519`; the hybrid format comes from a Zoom title bar
  reading "IBD Joint meeting FCHM and NTUH" in `IMG_1505`.

The one place the President's own words were altered: the greeting named October 2023 as
the founding, while the state registration is 5 March 2024. Both are true — founded as an
initiative, registered as an NGO the following March — and Chinguun agreed to reconcile
them into one sentence rather than pick one. That was raised explicitly rather than done
quietly, and any future edit to a named person's words deserves the same.

---

## Waiting on MSID

| | What | What it blocks |
| --- | --- | --- |
| ☐ | Gmail app password for `ibdmsid@gmail.com` | Every email the site sends. Until it exists, sends are skipped with a log line and the reset page says so. |
| ☐ | A domain | Search engines, canonical URLs, links inside emails. |
| ☐ | Bank details — bank, account number, holder | A participant registering for a paid event is told the Society will send payment details separately. |
| ☐ | 14 remaining board portraits | Two of sixteen have photographs. |
| ☐ | Remaining page text | Түүхэн замнал, further Эмнэлзүйн заавар, Эрдэм шинжилгээ, Түншүүд. |

---

## Open questions for MSID

- **Who is who in the 11 September front row?** The event is identified beyond doubt, but
  the four people photographed against the banner are not. Worth asking, because the hero
  caption could credit them. The panel name plates read CHEIN-CHIH TUNG, O.ANAR and a
  third ending `…URNULTSAIKHAN`.
- **The endoscopy suite group photograph is still unattributed.** No banner, no slide, no
  date on anything visible. It is a good photograph with nowhere honest to put it.

---

## Things that will bite you

- **Migrations are an array, not files.** `MIGRATIONS` in `src/lib/db/index.ts`, applied
  on connect. Three entries so far, all confirmed applied to production. Adding a column
  means adding an entry, not writing SQL by hand against Turso.
- **Never call `audit()` inside a transaction.** The module-level helper takes a fresh
  connection, which deadlocks against the open transaction with `SQLITE_BUSY`. This broke
  membership approval outright and silently for several commits. Use `auditTx(tx, …)` —
  see [src/lib/actions/admin.ts:457](src/lib/actions/admin.ts:457), where the reason is
  written down next to the call.
- **`MSID_SITE_URL`, never `NEXT_PUBLIC_SITE_URL`.** Next.js freezes `NEXT_PUBLIC_*` into
  the bundle at build time, so a value set in the runtime environment is silently ignored
  and the site reports whatever the build machine had. The un-prefixed name is settable
  after the build. `NEXT_PUBLIC_SITE_URL` is still honoured as a fallback.
- **Do not export anything from a `"use server"` module that is not meant to be an
  endpoint.** Every export becomes callable over the network. `relationOptions()` was
  moved to `src/lib/admin/options.ts` for exactly this reason.
- **The admin guide has one source.** `docs/admin-guide.html` is canonical; the PDF is
  generated from it with `npm run guide:pdf` (headless Chrome). Editing `ГАРЫН-АВЛАГА.md`
  or the PDF directly will be overwritten.
- **Mongolian is reviewed by Chinguun, not by me.** Corrections already applied include
  контентийг (not контентыг — a front-vowel loanword takes -ийг) and "хуудсан дээр шууд
  харагдана" in place of "хуудсанд шууд тусна". Propose Mongolian copy; do not consider it
  settled until he has read it.

---

## Going public

The mechanism is better than it looks. `isNoIndex()` in
[src/lib/site.ts:70](src/lib/site.ts:70) refuses indexing for any `*.vercel.app` origin.
**Adding a real domain in Vercel flips indexing on by itself** — Vercel starts reporting
the custom domain as the production URL, the `.vercel.app` test stops matching, and
`robots.txt` opens up.

Set `MSID_SITE_URL` anyway, to pin the origin so canonical tags, the sitemap, Open Graph
images and the links inside emails cannot drift onto a deployment hash. `MSID_NOINDEX=0`
is belt and braces.

What not to do: set `MSID_NOINDEX=0` while still on `msidwebsite.vercel.app`. It works —
the explicit value beats the domain rule — but it teaches Google that a Mongolian medical
society lives at a vercel.app subdomain, and then moves. Get the domain first.

---

## Also worth doing, nobody blocked

- **Add `ibdmsid@gmail.com` as an owner on Vercel and on Turso.** Both accounts are
  currently personal to Chinguun. If he is unreachable for a fortnight the site cannot be
  redeployed and the database cannot be reached, and no backup helps — a backup of a
  database nobody can restore into is a file. Five minutes, and it is step 4 of
  [LAUNCH.md](LAUNCH.md).
- **Backups from the first real member or registration, not before.** A backup of seeded
  content is ceremony. A scheduled `turso db dump` into a private repository is about
  twenty lines of GitHub Action.
- The three remaining audit findings, in [AUDIT.md](AUDIT.md): the unauthenticated
  registration lookup, on-demand rendering of every public page, and SVG uploads.

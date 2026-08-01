# MSID website

The website of the **Mongolian Society of Intestinal Disease** —
Монголын Гэдэсний Эмгэг Судлалын Нийгэмлэг (MSID), founded 5 March 2024.

Bilingual (Mongolian / English) public site, congress and programme registration, a
member portal, and an admin platform where every piece of content is editable in both
languages without touching code.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # then fill in SESSION_SECRET (see below)
npm run seed                   # creates the schema + first administrator
npm run dev                    # http://localhost:3000
```

Generate the session secret with:

```bash
openssl rand -base64 48
```

`npm run seed` prints the administrator email and password once. **Sign in at
`/mn/admin` and change the password immediately** (via the member portal's password
form).

### Sample content

To see the site populated before MSID's real content is ready:

```bash
npm run demo
```

This adds a congress with fee tiers and a three-day programme, a training course, two
guidelines, a publication, a news post, and three placeholder board members. Nothing in
it is real MSID information. Remove all of it with:

```bash
npm run demo:clear
```

---

## How it is built

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16, App Router, React 19 | Server components keep pages fast on hospital wifi; server actions mean forms work before JavaScript loads |
| Styling | Tailwind CSS v4, OKLCH tokens | Design tokens live in `src/app/globals.css`; see [DESIGN.md](DESIGN.md) |
| Database | **libSQL** (`@libsql/client`) | SQLite's dialect and schema, over HTTP. No ORM, no code generation, no native build step — and it runs both serverless and on a volume |
| Auth | `node:crypto` scrypt + signed JWT cookie (`jose`) | No third-party crypto dependency to keep patched |
| Validation | `zod` | Every form action validates on the server |

There are three runtime dependencies beyond React and Next. That is deliberate: this
site has to be maintainable by whoever MSID works with in three years' time.

### Why not an ORM

The database is SQLite, whether it lives in `data/msid.db` or in Turso — same dialect,
same schema, and any SQLite tool can open the file form. The schema is plain SQL in
[`src/lib/db/schema.ts`](src/lib/db/schema.ts)
with a comment on every non-obvious column, and row shapes are typed by hand in
[`src/lib/db/types.ts`](src/lib/db/types.ts). Moving to PostgreSQL later means rewriting
`src/lib/db/index.ts` and the query helpers — a contained change, because nothing above
that layer knows what the database is. Everything there is async for the same reason: a
hosted database call is a network round trip, and pages issue independent reads with
`Promise.all` rather than one after another.

---

## Project layout

```
src/
  app/
    [locale]/            every page is /mn/... or /en/...
      (site)/            public site + member portal
      (admin)/admin/     admin platform
    api/                 upload, CSV export, QPay callback
  components/
    site/                masthead, footer, record rows, public forms
    admin/               admin shell, resource editor, event extras
    ui/                  primitives shared by both
  lib/
    db/                  schema.ts, connection, row types
    i18n/                locale config + the MN/EN dictionary
    auth/                scrypt hashing, sessions
    actions/             server actions (auth, registration, admin)
    admin/resources.ts   the content registry — see below
    payments/qpay.ts     QPay v2 client
scripts/
  seed.mts               schema + first administrator + MSID's own facts
  demo.mts               sample content (add / clear)
```

### The content registry

The admin does not contain twelve hand-written forms. Every editable content type —
events, guidelines, publications, news, board members, partners, history, pages — is
declared in [`src/lib/admin/resources.ts`](src/lib/admin/resources.ts), and one editor
renders all of them with paired **Монгол / English** inputs side by side.

To add a field: add the column to `schema.ts`, add a matching entry to that resource's
`fields` array, and it appears in the admin and can be read on the public side. No new
form.

The registry is also the security boundary — table and column names used in generated
SQL come from it, never from request data.

---

## Bilingual content

Mongolian is the default locale and the primary language; English is a full peer.

- Interface strings live in [`src/lib/i18n/dictionaries.ts`](src/lib/i18n/dictionaries.ts).
  The Mongolian object defines the shape, so a key missing from English is a build error.
- Content authored in the admin is stored as `_mn` / `_en` column pairs.
- `tr(row, "title", locale)` returns the requested language and falls back to the other
  one when it is empty, so a partially translated record stays readable instead of
  rendering blank. The page then shows a "not yet translated" notice.
- The admin list flags any record that has English but no Mongolian.

**Fonts must carry the `cyrillic-ext` subset.** That is the subset containing Ө ө
(U+04E8–9) and Ү ү (U+04AE–F). Without it, Mongolian renders with fallback glyphs in the
middle of words. Both families here — Commissioner and Literata — were checked against
the Google Fonts CSS before being chosen.

---

## Registration and payment

The flow works today with **bank transfer**:

1. A participant registers on `/[locale]/events/<slug>/register`.
2. They receive a reference such as `MSID-2026-LYS46W` and payment instructions.
3. They transfer the fee, putting the reference in the transfer description.
4. An administrator marks the registration paid in **Admin → Бүртгэл**.

Fee tiers support an early-bird amount that applies automatically until the event's
early-bird deadline, and a member-only tier that is hidden from non-members. **Prices
are always recalculated on the server** from the event record — the amount posted by the
browser is never trusted.

Registrations export to CSV with a UTF-8 BOM (so Excel on Windows reads Mongolian
correctly) and with formula-injection guarding on every cell.

### Enabling QPay

QPay support is written and wired; it needs credentials MSID does not have yet.

1. Sign a merchant agreement with QPay.
2. Put the credentials in `.env.local`:
   ```
   QPAY_USERNAME=…
   QPAY_PASSWORD=…
   QPAY_INVOICE_CODE=…
   QPAY_CALLBACK_SECRET=…      # openssl rand -hex 32
   MSID_SITE_URL=https://msid.mn
   ```
3. Tick **QPay-г идэвхжүүлэх** in Admin → Тохиргоо.

Participants then get a QR code and bank-app deep links. A registration is marked paid
**only** after the server calls QPay's `payment/check` and confirms the amount — the
callback is treated as a hint, never as proof, so a forged callback cannot mark anything
as paid. If invoice creation fails, the registration is still saved and quietly falls
back to bank transfer rather than losing the participant.

Until bank details are entered in Admin → Тохиргоо, the confirmation page tells
participants they will be sent payment details by email, and the admin dashboard shows a
warning. It never renders an empty payment table.

---

## Membership

Applications arrive through `/[locale]/membership/apply` and land as **pending**. An
applicant cannot sign in until an administrator sets their membership to **Хүчинтэй
(Active)** in Admin → Гишүүд — that single action grants access, sets the join date, and
unlocks member registration rates.

Roles: `admin` (everything, including creating users), `editor` (all content), `member`
(portal only). The last remaining administrator cannot demote themselves.

---

## Deployment

The app runs on **libSQL** — SQLite's dialect and schema, reached over HTTP. That one
choice is what lets the same code run both on a serverless host with no disk and on a
container with a volume.

| | Database | Uploads |
|---|---|---|
| **Vercel** | Turso (`TURSO_DATABASE_URL`) | Vercel Blob (`BLOB_READ_WRITE_TOKEN`) |
| **Railway / Render / VPS** | local file on a volume (`MSID_DB_PATH`) | same volume (`MSID_UPLOAD_DIR`) |
| **Local development** | `./data/msid.db` | `./public/uploads` |

Nothing selects this at build time — the app checks the environment at runtime, so the
same commit deploys to either.

### Vercel

1. **Add Turso** from the [Vercel Marketplace](https://vercel.com/marketplace/tursocloud),
   or create one yourself and set `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`:
   ```bash
   turso db create msid
   turso db show msid --url
   turso db tokens create msid
   ```
2. **Add a Blob store** (Storage → Create → Blob). Vercel sets
   `BLOB_READ_WRITE_TOKEN` for you. Without it, uploading a guideline PDF fails —
   Vercel has no writable disk.
3. **Set the remaining variables:**

   | Variable | Value |
   |---|---|
   | `SESSION_SECRET` | `openssl rand -base64 48` |
   | `ADMIN_EMAIL` / `ADMIN_PASSWORD` | the first administrator |
   | `MSID_SITE_URL` | optional — Vercel's own domain is detected via `VERCEL_PROJECT_PRODUCTION_URL`. Set this once you have a custom domain |
   | `MSID_NOINDEX` | `0` once you launch on a real domain |

4. **Seed the database once**, from your machine, pointing at Turso:
   ```bash
   TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… npm run seed
   TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… npm run demo     # optional sample content
   ```
   The schema itself is applied automatically on first connection; `seed` adds MSID's
   published facts and the first administrator.

5. **Deploy.** Import the GitHub repo; no build configuration needed.

### Railway / Render — no external services

A `Dockerfile`, `railway.json` and an idempotent entrypoint are included. Leave
`TURSO_DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` unset and the app uses the volume for
both database and uploads.

1. **New Project → Deploy from GitHub repo →** `MSID-website`. The Dockerfile is detected.
2. **Add a Volume**, mount path **`/data`**. Without it the database is wiped on every
   redeploy.
3. **Variables:** `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and
   `MSID_SEED_DEMO=1` to come up with sample content. `MSID_DB_PATH` and
   `MSID_UPLOAD_DIR` are already set in the Dockerfile to point at the volume.
4. **Generate a domain** under Settings → Networking. Railway publishes it as
   `RAILWAY_PUBLIC_DOMAIN`, which the app reads on its own — no domain purchase needed
   for a client review.

### Any VPS

```bash
npm ci
npm run build
npm start                      # port 3000; put nginx or Caddy in front for TLS
```

| Variable | Purpose |
|---|---|
| `SESSION_SECRET` | Required. ≥32 characters |
| `MSID_DB_PATH` | e.g. `/var/lib/msid/msid.db` — on a persistent volume |
| `MSID_UPLOAD_DIR` | e.g. `/var/lib/msid/uploads` |
| `MSID_SITE_URL` | `https://msid.mn` — canonical URLs, sitemap, QPay callbacks |
| `MSID_NOINDEX` | `0` to allow search engines. Preview hosts are hidden automatically |
| `QPAY_*` | Only once QPay credentials exist |

With the filesystem backend, uploads are served by a route handler
(`/uploads/[...path]`) rather than static hosting, so they work from a volume outside
the project. It serves only image and PDF types and refuses any path resolving outside
the upload directory.

**Backup.** On Turso, use its managed backups. On a file database,
`sqlite3 msid.db ".backup backup.db"` (safe while running) plus the uploads directory.

### Search engine visibility

Preview deployments hide themselves. Any `*.vercel.app`, `*.up.railway.app`,
`*.onrender.com` or localhost origin serves `Disallow: /` and `noindex`, because a
client-review instance carries sample content — invented guideline codes, a placeholder
congress — that would be actively harmful indexed under a medical society's name.

Set `MSID_SITE_URL` to the real domain and `MSID_NOINDEX=0` at launch. The admin
dashboard warns on every visit while a deployment is hidden, so this cannot be forgotten.

### Administrator accounts

```bash
ADMIN_EMAIL=you@example.com ADMIN_NAME="Таны нэр" ADMIN_PASSWORD='…' npm run admin
```

Creates an administrator, or promotes and resets the password of an existing account —
so this is also the recovery path for a forgotten password. Credentials come from the
environment rather than arguments, so they stay out of shell history. Add
`TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` to run it against production.

---

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm run seed` | Apply schema, seed MSID's own facts, create the first administrator |
| `npm run demo` / `npm run demo:clear` | Add / remove sample content |

---

## Accessibility

Target WCAG 2.2 AA, checked rather than assumed:

- Body text ≥ 4.5:1, large text ≥ 3:1, verified in-browser against resolved colours
  (the tokens are OKLCH, so contrast has to be measured, not eyeballed from hex values).
  Muted prose stops at the `ink-600` token; anything lighter is decoration, not text.
- Every page keyboard-operable with a visible focus ring; skip-to-content link.
- `prefers-reduced-motion: reduce` collapses every animation. No content is revealed
  only by a scroll-triggered transition, so it renders in headless browsers too.
- Wide tables scroll inside their own container; the page body never scrolls sideways.
- Status is always carried by a word as well as a colour.

---

## What is not built

Stated plainly so nothing comes as a surprise:

- **Email is not sent.** Membership approvals and payment confirmations are recorded in
  the admin, but no email leaves the server — that needs an SMTP account or a service
  such as Resend, and a decision about which address MSID sends from.
- **Rich-text editing.** Admin content is plain text with blank lines between
  paragraphs. This is also why no HTML is ever interpolated and there is no injection
  surface.
- **QPay** is wired but inert until credentials exist (above).
- **Real content.** The site ships with MSID's own confirmed facts only — name, founding
  date, mission (the Society's own published wording), address, contacts, and the three
  partner organisations MSID publicly links to. Board members, guidelines, congress
  dates and publications are for MSID to add.

Design rationale is in [PRODUCT.md](PRODUCT.md) (who it is for, what it must not look
like) and [DESIGN.md](DESIGN.md) (colour, type, components).

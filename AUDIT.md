# MSID website — audit

Reviewed on 1 August 2026, against the code as deployed to `msidwebsite.vercel.app`.
Findings closed on 2 August are marked **CLOSED** in place rather than deleted, so the
record of what was wrong survives alongside what was done about it.
Covers security, the server, the browser, and the experience of using the site and the
admin. Roughly 13,000 lines of TypeScript across 84 files.

Findings are split into **fixed in this pass** and **open**. Everything open carries a
severity and, where it needs one, the decision MSID has to make before it can be closed.

---

## Second pass — 18 August 2026

A 20-point pre-launch checklist run against the tree (secrets, git history, auth on
routes and actions, IDOR, field tampering, cookies, hashing, throttling, bot protection,
parameterised SQL, validation, escaping, uploads, response leakage, headers, HTTPS,
dependencies). Thirteen passed outright and the "what holds up well" claims below were
re-verified against the code. What changed:

- **Dependencies:** `next` 16.2.12 → 16.3.1, `npm audit fix` for the rest. From four
  high advisories (sharp/libvips — which `next/image` uses on admin-uploaded images —
  postcss, nanoid) to zero. 16.3 removed the inert `experimental.viewTransition` flag,
  so it is gone from `next.config.ts`; the `<ViewTransition>` template works without it.
- **Admin pages check the session themselves.** `requireStaffPage(locale)` in
  `src/lib/auth/session.ts`, called at the top of all eight `/admin/**` pages. The layout
  still checks too, but a layout is not a guard: Next can render a page segment without
  re-running the layout on soft navigation and partial RSC requests. `currentUser()` is
  request-cached, so the second check is free.
- **`password_hash` never leaves the query layer.** `getMemberRecord`, `listMembers`
  and `listStaffUsers` select user columns by name instead of `u.*`; `MemberRecord`
  omits the field in its type as well.
- **Registration lookups throttled** (item 4 below, now closed).
- **Headers:** `Strict-Transport-Security` (2 years, includeSubDomains) and a
  `Content-Security-Policy-Report-Only` with a real `default-src` policy. The report-only
  header blocks nothing; it logs violations to the console so the enforced policy can be
  tightened from evidence. `frame-ancestors 'none'` remains enforced.
- **Staff-side input tightened.** The generic form rejects a select value outside its
  option list and a non-finite number, and caps free text; event fee and programme
  actions parse through zod (audience enum, non-negative integer amounts, ISO dates,
  200-char labels); `createStaffAction` validates the email format; `updateMemberAction`
  drops malformed dates instead of writing them; `saveSettingsAction` writes only known
  keys. Guideline and publication download links pass through `safeFileHref()`, which
  admits `/uploads/…` and http(s) only. SVG removed from the upload allow-list.
- `.dockerignore` now excludes every `.env*` file and `.vercel/`.

Still open from the list below: a backup schedule (6 — the tooling exists, the habit
does not yet), on-demand rendering (8). Item 5 was checked against production the same
day and closed. Checked and closed: the Blob token fragment that briefly
appeared in commit `1bc7c29` is 32 characters — the public `vercel_blob_rw_` prefix, the
store id and a trailing underscore, none of the secret — so no rotation is needed.

---

## Fixed in this pass

### SQL injection reachable by any editor account — was high

`relationOptions()` lived in `src/lib/actions/admin.ts`, a `"use server"` module. Every
export of such a module is a callable endpoint, and this one interpolated a column name
straight into SQL:

```ts
`SELECT id AS value, COALESCE(NULLIF(${labelColumn}_mn, ''), ${labelColumn}_en) AS label
 FROM ${table} …`
```

The table was checked against an allow-list; the column was not. Anyone holding an
editor account — the lower of the two staff roles — could have called it with a crafted
column name and read anything the query could reach, including password hashes.

Moved to [src/lib/admin/options.ts](src/lib/admin/options.ts), which is a plain
`server-only` module rather than a server action, so it is no longer an endpoint at all.
The table and column are now matched against the content registry, so both come from
code and never from a request.

### No limit on sign-in attempts — was medium

The admin has two accounts on it, both belonging to people who can be named from MSID's
own Facebook page. Nothing stopped a script from guessing at either address indefinitely.

It was also a way to run up a bill. Verifying one password runs scrypt at the OWASP
parameters — about 130 MB of memory and a tenth of a second of CPU — so an unthrottled
form lets a single script exhaust a serverless function without ever guessing anything.

[src/lib/auth/throttle.ts](src/lib/auth/throttle.ts) now refuses after 8 failures against
one email address, or 30 from one network address, within fifteen minutes. The check runs
**before** the password is verified, which is what makes it a cost control and not only a
guessing limit. A correct password clears the address's own counter.

Verified: the ninth attempt in a row returns "Хэт олон удаа буруу оролдсон байна", and a
correct password still signs in.

### The site could be framed by another site — was medium

No response headers were set at all. The admin panel could be loaded in an invisible
iframe on a page an administrator was tricked into visiting, and their clicks landed on
controls they could not see — including "Устгах".

[next.config.ts](next.config.ts) now sends `frame-ancestors 'none'`, `X-Frame-Options`,
`X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin` and a
`Permissions-Policy` that gives away camera, microphone, location and payment.

There is deliberately **no** full Content-Security-Policy. A useful one has to allow the
framed video players and Next's own inline bootstrap, and a policy loose enough to do
both would be decoration. Nothing in this codebase renders HTML from the database — there
is no `dangerouslySetInnerHTML` anywhere — so the effort belongs in keeping it that way.

### Deleting an event destroyed its registrations — was medium

`deleteResourceAction` ran a single `DELETE`, and the schema's `ON DELETE CASCADE` would
have taken the registrations with it — participants' names, contact details and payment
records — on a click behind one `window.confirm`.

An event that has registrations can no longer be deleted at all
([src/lib/admin/deletion.ts](src/lib/admin/deletion.ts)). The editor replaces the delete
button with an explanation naming the number of registrations and pointing at the
"Архивласан" status, which takes the event off the site and keeps everything. The action
re-checks server-side, because it is an endpoint of its own.

Fees and programme rows are now deleted explicitly rather than left to the foreign key —
see "Foreign keys may not be enforced" below for why that matters.

### Administrator-supplied links went into `href` unchecked — was low

Partner URLs, publication links, event links and the Facebook URL in settings were
rendered directly. A `javascript:` URL stored by a compromised or careless staff account
would have been an XSS vector on a public page. All of them now go through
`safeExternalLink()`, which accepts only `http:` and `https:`.

### Every request queried the same rows several times

Nothing was wrapped in React's `cache()`, so:

- the footer read `site_settings` on every page, and six pages read it again;
- the masthead resolved the signed-in user, then the admin layout resolved them again,
  then the page inside it a third time;
- every detail page ran its slug lookup twice — once in `generateMetadata`, once in the
  page body.

Against a local SQLite file that is a disk read. Against Turso it is a network round trip
to another machine, repeated. `getSettings`, `currentUser` and the four `…BySlug`
lookups are now request-scoped.

### "View on site" 404'd for anything unpublished

The natural workflow — write a congress page, look at it, publish it — was broken: the
preview link in the editor returned "not found" until the record was published, so the
only way to see a draft was to publish it to the public site first.

Signed-in staff now see unpublished records on the public pages, under a banner saying so
in plain language. Everyone else still gets a 404, which was verified both ways.

### Smaller things

- The upload picker offered `image/*`, so an iPhone happily handed over a HEIC photo that
  the server then rejected. It now offers exactly what the server accepts, and says so.
- The admin's delete wording used "бичлэг" for *record*, which now means *video*
  elsewhere on the site. Records are "контент" throughout.
- `uploadDirectory()` no longer reads `process.cwd()` at module scope.

---

## Open

### 1. Nothing sends email — CLOSED

Was the largest gap between what the site promised and what it did: an applicant read
"Батлагдмагц и-мэйлээр мэдэгдэнэ", was approved, and heard nothing.

`src/lib/email/` now holds an SMTP mailer and the message text. Five messages go out —
password reset, membership approval, registration confirmation, and a notice to MSID on
each new application and registration. All but the reset go through `notify()`, which
logs and swallows: a registration that failed because Gmail was briefly unreachable
would be worse than one whose confirmation is missing.

Deliberately still not sent: a rejection email, and a payment-received email. The first
is a conversation, not a notification; the second waits on somebody confirming the money
arrived, which is manual until QPay exists.

Needs `SMTP_*` configured — see the README. Until then every send is skipped with a line
in the log and nothing breaks.

**Found while testing this:** approving a membership was broken outright.
`updateMemberAction` called the module-level `audit()` from inside its transaction,
which opens a second connection and deadlocks against the write lock the transaction
holds. The admin got "Алдаа гарлаа" and the approval never committed — the single most
important action in the panel for a membership organisation, broken since the libSQL
migration in `60df511`. Now uses `auditTx`.

### 2. No way to reset a forgotten password — CLOSED

Built. `/mn/forgot-password` sends a one-hour, single-use link; only the token's SHA-256
is stored; completing a reset cuts every session on the account. Requires `SMTP_*` to be
configured — see "Email and password resets" in the README. Until it is, the page says so
and points at the Society's address rather than accepting a request that goes nowhere.

### 3. The public forms have no anti-abuse limit — CLOSED

Wiring the emails raised the stakes: every submission now also sends mail from MSID's
own address, so a script working through these forms spends the Society's sending
reputation and would take the password-reset emails down with it.

Three checks, none visible to an honest applicant and none needing a third-party
service: a generous per-address limit (10 applications, 20 registrations an hour — a
hospital puts its whole staff behind one address), an off-screen honeypot field, and a
signed minimum fill time.

A trip returns an ordinary "please try again" rather than a silent fake success, because
a false positive that leaves a doctor believing they applied is the worse failure.

Honest about the weakest of the three: the timing check only catches a bot that fetches
the page and posts within three seconds.

### 4. The registration page shows personal data to anyone with the reference — CLOSED

`/mn/registration/MSID-2026-XXXXXX` shows the participant's name, email address and
amount due, to anyone who has the code. It is marked `noindex` and the code is one of
about a billion, which is the same design an airline uses for a booking reference — and
now, as of 18 Aug 2026, guesses are rate-limited: `checkLookupThrottle()` in
`src/lib/auth/throttle.ts` counts *misses* per address (30 an hour) and past the limit
every lookup from that address gets the same 404 a wrong reference does. Hits are never
counted, so a participant reloading their own page is unaffected.

### 5. Foreign keys may not be enforced in production — CLOSED

Checked 18 Aug 2026 with `npm run backup` against the production Turso database, on the
same connection path the app uses: `PRAGMA foreign_keys` returned 1. The declared
cascades fire in production; nothing further needed. Original analysis kept below.

The schema declares 11 foreign keys with `ON DELETE CASCADE` and `ON DELETE SET NULL`.
SQLite only honours them when `PRAGMA foreign_keys = ON` is set **for the connection** —
and this application only sends that pragma for a local file, because sending it to Turso
alongside `journal_mode = WAL` is what took the whole site down during the Vercel
migration.

Verified locally: with the pragma, cascades fire and orphan inserts are rejected. Against
Turso it is unverified, and a per-connection pragma set once at connection time has no
guarantee of applying to statements sent later over HTTP.

Where it matters: deleting a staff account should remove their sessions; deleting a member
should remove their profile. Events no longer depend on it — they clean up after
themselves — but the others still do.

**One check closes this:** `npm run backup` with the Turso variables set prints whether
foreign keys are enforced on the app's own connection, as its first line. If it says NOT
enforced, the remaining deletions need the same explicit treatment events got.

### 6. No backups — tooling done, schedule needed

Turso's free plan has no point-in-time restore. Every member record, registration and
piece of content lives in one database with no copy. `npm run backup` (added 18 Aug 2026,
`scripts/backup.mts`) writes a full SQL dump to `backups/` that restores into any SQLite
or libSQL; verified round-trip locally. What remains is a habit: run it weekly with the
Turso variables set and keep the file somewhere other than the laptop that made it — or
take the paid plan.

### 7. SVG uploads are allowed — CLOSED

`image/svg+xml` was in the upload allow-list, and an SVG can carry script. Removed on
18 Aug 2026 (`src/lib/storage.ts`); every logo and photograph the site has needed was a
JPEG or PNG. If a vector logo is ever wanted, export it to PNG — or add the type back
together with a sanitiser, never alone.

### 8. Everything is rendered on demand — low

All 65 routes are dynamic; nothing is cached or pre-rendered. Every visitor to the home
page causes queries to a database in another region. Since `revalidatePath("/", "layout")`
already runs on every admin save, adding `revalidate` to the public pages would make them
near-instant with no risk of stale content. Worth doing before any real traffic.

### 9. Navigation has no loading state — CLOSED

`loading.tsx` for the public site and for the admin, shaped like the real layout so the
page settles rather than jumps. The footer streams instead of blocking the whole layout
on its settings query, and the page body crossfades between routes.

### 10. Notes, no action required

- ~~`saveSettingsAction` writes any key present in the form into `site_settings`.~~ Done
  18 Aug 2026: only keys in `SETTING_DEFAULTS` are written, values capped at 5 000 chars.
- `verifyPassword` trusts the cost parameters recorded in the stored hash. Only reachable
  by someone who can already write to the `users` table.
- Seeding runs inside `connect()` and swallows its errors on purpose — a site that renders
  empty beats one that returns 500 — which means a broken seed is visible only in the logs.
- The build warns that the `/uploads/[...path]` route traces broadly. It streams arbitrary
  files off disk, so it genuinely does dynamic reads; on Vercel the route is dead code.

---

## What holds up well

Worth recording, because these are the things an audit usually finds broken:

- **No XSS surface.** Nothing renders HTML from the database. Body text goes through a
  paragraph splitter into React text nodes.
- **No SQL built from request data.** Every query is parameterised. Table and column names
  in generated SQL come from the content registry, which is code.
- **Passwords** use scrypt at the OWASP parameters with a per-password salt and a
  constant-time comparison.
- **Sessions** are a signed JWT *and* a database row, so an administrator can revoke access
  immediately rather than waiting fourteen days for expiry. Changing a password cuts every
  other session.
- **The QPay callback is treated as a hint, not a fact.** A registration is marked paid only
  after a fresh `payment/check` call to QPay confirms the amount. A forged callback achieves
  nothing.
- **The registration price is computed on the server** from the event row, never read from
  the posted form.
- **The CSV export escapes formula injection**, so a participant cannot put `=HYPERLINK(…)`
  in their name and have it run when an administrator opens the file in Excel.
- **The uploads route resolves and re-checks every path** against its root, so `..` cannot
  escape, and serves only the six types the upload endpoint accepts, under
  `default-src 'none'; sandbox`.
- **Accessibility basics are in place**: one `h1` per page, a skip link, real landmarks,
  `lang` on `<html>`, alt text on every image, no unlabelled controls, and status conveyed
  by words rather than colour alone.
- **No horizontal overflow at 375 px**, including pages carrying three data tables.

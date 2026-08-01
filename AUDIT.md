# MSID website — audit

Reviewed on 1 August 2026, against the code as deployed to `msidwebsite.vercel.app`.
Covers security, the server, the browser, and the experience of using the site and the
admin. Roughly 13,000 lines of TypeScript across 84 files.

Findings are split into **fixed in this pass** and **open**. Everything open carries a
severity and, where it needs one, the decision MSID has to make before it can be closed.

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

### 1. Nothing sends email — high, needs a decision

There is no mail integration anywhere in the codebase. That means:

- A membership application is silently queued. The applicant is told, in MSID's own
  words, "Батлагдмагц и-мэйлээр мэдэгдэнэ" — and no email is ever sent.
- Approving a member sends nothing. The applicant has no way to know they can sign in.
- A congress registration produces a reference number on screen and nothing else. If the
  participant closes the tab, their payment reference is gone.
- MSID is not notified of a new application or registration; someone has to remember to
  open the admin and look.

This is the largest gap between what the site promises and what it does. It also blocks
item 2.

**Decision needed:** a transactional email provider (Resend and Postmark both work from
Vercel with a few lines) and a `From` domain MSID controls. Roughly half a day's work
once that exists.

### 2. No way to reset a forgotten password — high, depends on 1

There is no reset flow. Recovery today means running `npm run admin` from a laptop that
has the production database credentials. For a two-person society, one forgotten password
is a locked admin panel until a developer is available.

### 3. The public forms have no anti-abuse limit — medium, needs a decision

The membership application and the event registration form are both open to the internet
with no throttle and no challenge. A script can create unlimited pending member accounts
and registrations. Nothing is destroyed — everything lands in the admin as pending — but
the members list and the registrations table become unusable, and each application runs
one password hash.

The sign-in throttle's table works for these too, keyed by address. The alternative — an
emailed confirmation link before the record becomes visible — is better but depends on 1.

### 4. The registration page shows personal data to anyone with the reference — medium

`/mn/registration/MSID-2026-XXXXXX` shows the participant's name, email address and
amount due, to anyone who has the code. It is marked `noindex` and the code is one of
about a billion, which is the same design an airline uses for a booking reference.

But nothing rate-limits guesses at it. If MSID ever runs a congress with a few hundred
paying participants, that is a scan worth someone's time.

**Options:** rate-limit the route by address, or require the email address as a second
value on the link. Neither is urgent while there are no live registrations.

### 5. Foreign keys may not be enforced in production — medium, one check needed

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

**One check closes this:** run `PRAGMA foreign_keys;` against the production database. If
it returns 0, the remaining deletions need the same explicit treatment events got.

### 6. No backups — medium, needs a decision

Turso's free plan has no point-in-time restore. Every member record, registration and
piece of content lives in one database with no copy. A `turso db shell … .dump` on a
schedule, or the paid plan, would both do.

### 7. SVG uploads are allowed — low

`image/svg+xml` is in the upload allow-list, and an SVG can carry script. On Vercel Blob
these are served from `*.public.blob.vercel-storage.com` — a different origin, so a script
inside one cannot touch the site or its cookies. Only staff can upload. If MSID has no
need for SVG logos, removing the one line closes it entirely.

### 8. Everything is rendered on demand — low

All 65 routes are dynamic; nothing is cached or pre-rendered. Every visitor to the home
page causes queries to a database in another region. Since `revalidatePath("/", "layout")`
already runs on every admin save, adding `revalidate` to the public pages would make them
near-instant with no risk of stale content. Worth doing before any real traffic.

### 9. Navigation has no loading state — low

There is no `loading.tsx` anywhere. Clicking a link does nothing visible until the server
has finished its queries. On a Mongolian mobile connection to a database in another
region, that pause is the most noticeable thing about the site's speed — and a skeleton
is a few lines per route group.

### 10. Notes, no action required

- `saveSettingsAction` writes any key present in the form into `site_settings`. Staff-only,
  and unknown keys are ignored on read; intersecting with `SETTING_DEFAULTS` would be tidier.
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

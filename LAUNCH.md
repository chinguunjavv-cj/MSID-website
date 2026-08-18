# Launch checklist

What has to happen between now and MSID's website being publicly theirs, in the order it
has to happen. Everything here is either a step you take or a thing MSID has to supply —
no code is outstanding for any of it.

The site is currently live at `msidwebsite.vercel.app`, seeded, and **deliberately
hidden from search engines**. That is not an oversight; see step 5.

---

## What MSID has to supply

Chase these first. They are the long poles, and nothing below finishes without them.

| | What | Why it blocks |
| --- | --- | --- |
| ☑ | ~~**Gmail app password** for `ibdmsid@gmail.com`~~ — **done via Brevo, 18 Aug 2026.** Google refused to generate an app password for the account ("There was an error generating your app password", every browser). Outgoing mail now goes through Brevo's SMTP relay with `ibdmsid@gmail.com` as the verified sender; see section 1. | Every email the site sends. |
| ☐ | **Real content** — board members, guidelines, congress dates, publications | The site currently shows sample content with invented guideline codes and a placeholder congress. This is the single reason it must stay hidden from search engines. |
| ☐ | **A domain** | Everything in step 5. |
| ☐ | **Bank details** — bank, account number, account holder | Until these are in Тохиргоо → Төлбөр, a participant registering for a paid event is told the Society will send payment details separately, rather than being shown where to transfer. |

---

## 1. Email

☑ **Done (18 Aug 2026) — Brevo, not Gmail.** Google would not issue an app password for
`ibdmsid@gmail.com`, so the site sends through Brevo's free SMTP relay (300/day) with
`ibdmsid@gmail.com` added and verified as a sender in the Brevo account. Vercel holds:

```
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=<the Brevo SMTP login, e.g. xxxxxxxx@smtp-brevo.com>
SMTP_PASSWORD=<the Brevo SMTP key>
MAIL_FROM=MSID <ibdmsid@gmail.com>
```

Two things learned the hard way, so nobody repeats them: `MAIL_FROM` must be exactly a
verified Brevo sender or the relay answers `451 Invalid from` (the site logs it, the user
sees the usual "if that address has an account…" message and nothing arrives); and the
Vercel value field takes the bare value — `MSID <ibdmsid@gmail.com>`, not
`MAIL_FROM=MSID <…>`.

Brevo will show DKIM/DMARC warnings against the gmail.com sender. They are advice, not a
block — a freemail sender cannot be authenticated. Once MSID has a domain (step 5), add it
under Brevo → Senders & IP → Domains, authenticate it, and change `MAIL_FROM` to an
address on it; the warnings go away and deliverability improves.

☑ Verified live: `/mn/forgot-password` delivered a reset link to `chinguunjavv@gmail.com`
and the password was changed through it. If it ever stops, look at Brevo → Transactional
→ Logs first (empty = the site never reached Brevo; check `vercel logs` for the SMTP
error), then at the Brevo log line for the message.

☐ Tell MSID what now goes out in their name. Section 8 of the administrator's guide lists
it; the point they will care about is that approving a membership emails the applicant
immediately, so they no longer need to ring people.

## 2. Load MSID's real content

The imports are idempotent and take the **original** files — they resize as they go — so
they can be re-run after any correction. Export the credentials once, then run all three:

```bash
export TURSO_DATABASE_URL='libsql://…'
export TURSO_AUTH_TOKEN='…'
export BLOB_READ_WRITE_TOKEN='vercel_blob_rw_…'

npm run import:board -- \
  --photo "Bayarmaa O.=/path/to/president.jpeg" \
  --photo "Bat-Ulzii E.=/path/to/vice-president.jpg"

npm run import:assets -- --guideline "/path/to/Заавар UC.pdf"

npm run import:events -- \
  --aocc "/path/to/aocc-delegation.JPG" \
  --ddweek "/path/to/ddweek-session.jpg" \
  --taiwan "/path/to/IMG_1519.jpg"
```

`BLOB_READ_WRITE_TOKEN` is not optional here. Without it the photographs are written to
a local disk that Vercel cannot read, and the database ends up holding `/uploads/…`
paths that resolve to nothing in production.

## 3. Replace the remaining sample content

☐ The board, the President's greeting, the UC guideline and two past events arrive with
the imports above. Still to write with MSID: Түүхэн замнал, further Эмнэлзүйн заавар,
Эрдэм шинжилгээ, Түншүүд, and the remaining Хуудсууд text.

☐ Delete or archive the demo records. They are recognisable by their slugs —
`demo-msid-congress`, `demo-endoscopy-course`, `demo-news-congress-open`. An event with
registrations cannot be deleted; archive it instead.

☐ Set the home page hero in Тохиргоо → Нүүр хуудас.

## 4. Accounts, before the domain

☐ Add `ibdmsid@gmail.com` as an owner on the **Vercel** project and the **Turso**
database.

This matters more than it looks. Both accounts are currently personal to you. If you and
MSID part ways, or you are simply unreachable for a fortnight, the site cannot be
redeployed, the database cannot be reached, and no backup would help — a backup of a
database nobody can restore into is a file. It costs nothing and takes five minutes.

☐ Create a second administrator account for MSID's own person, in Хэрэглэгчид, so the
site is not administered from one login.

## 5. Domain and going public

Do these together, in this order.

☐ Add the domain in Vercel and point the DNS at it.

☐ Set `MSID_SITE_URL` to the real origin — e.g. `https://msid.mn`. This is what canonical
URLs, the sitemap, Open Graph tags and the links inside emails are built from. It is
**not** prefixed `NEXT_PUBLIC_`, on purpose: that kind is frozen into the bundle at build
time and would ignore a value set at runtime.

☐ Set `MSID_NOINDEX=0`.

Until this is set, every page serves `noindex` and `robots.txt` says `Disallow: /`. That
is automatic for any `*.vercel.app` origin, because a client-review instance carries
invented guideline codes and a placeholder congress — content that would be actively
harmful indexed under a medical society's name. The admin dashboard warns on every visit
while the site is hidden, so this cannot be forgotten silently.

☐ Redeploy, then confirm: `curl -s https://<domain>/robots.txt` should no longer say
`Disallow: /`, and a page's source should no longer contain `noindex`.

☐ Submit the domain to Google Search Console.

## 6. Once there is real data

Not before — there is nothing to lose today, and a backup of demo content is ceremony.

☐ From the first real member or registration: a scheduled `turso db dump` into somewhere
MSID controls. A GitHub Action into a private repository is about twenty lines.

☐ Check whether Turso enforces foreign keys. One command against the production database:

```
turso db shell msid "PRAGMA foreign_keys;"
```

If it returns `0`, deletions that rely on `ON DELETE CASCADE` are not cascading. Events
already clean up after themselves in application code; users and member profiles do not.
Finding 5 in [AUDIT.md](AUDIT.md) has the detail.

---

## Still open, with nobody blocked on them

From [AUDIT.md](AUDIT.md). All three that stood here on 9 August were closed on 18 August
— registration lookups are throttled, published content is cached, SVG uploads are gone;
AUDIT.md has the detail. What remains:

- **A backup habit.** `npm run backup` with the Turso variables writes a restorable dump;
  nothing runs it on a schedule. Weekly, kept off the laptop, until MSID takes Turso's
  paid plan.

## Things that are done and worth knowing

So you can answer for them if MSID asks:

- Passwords are scrypt at the OWASP parameters. Sign-in refuses after 8 failures on an
  address within fifteen minutes, checked *before* the password is verified.
- Sessions are a signed cookie **and** a database row, so access can be revoked
  immediately rather than waiting fourteen days. Changing a password cuts every other
  session.
- The two public forms carry a rate limit, a honeypot and a signed fill-time check.
- The QPay callback is treated as a hint: a registration is marked paid only after a
  fresh check with QPay confirms the amount. A forged callback achieves nothing.
- No page renders HTML from the database, and every query is parameterised.
- An event with registrations cannot be deleted.

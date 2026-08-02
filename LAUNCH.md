# Launch checklist

What has to happen between now and MSID's website being publicly theirs, in the order it
has to happen. Everything here is either a step you take or a thing MSID has to supply —
no code is outstanding for any of it.

The site is currently live at `msidwebsite.vercel.app`, seeded, and **deliberately
hidden from search engines**. That is not an oversight; see step 4.

---

## What MSID has to supply

Chase these first. They are the long poles, and nothing below finishes without them.

| | What | Why it blocks |
| --- | --- | --- |
| ☐ | **Gmail app password** for `ibdmsid@gmail.com` | Every email the site sends. Until it exists, sends are skipped with a log line and the password-reset page says so. See "Email and password resets" in the README for the steps to give them. |
| ☐ | **Real content** — board members, guidelines, congress dates, publications | The site currently shows sample content with invented guideline codes and a placeholder congress. This is the single reason it must stay hidden from search engines. |
| ☐ | **A domain** | Everything in step 4. |
| ☐ | **Bank details** — bank, account number, account holder | Until these are in Тохиргоо → Төлбөр, a participant registering for a paid event is told the Society will send payment details separately, rather than being shown where to transfer. |

---

## 1. Email

☐ Add to Vercel → Settings → Environment Variables, then redeploy:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=ibdmsid@gmail.com
SMTP_PASSWORD=<the 16-character app password>
MAIL_FROM=MSID <ibdmsid@gmail.com>
```

☐ Verify by using the site rather than by reading the config: open `/mn/forgot-password`,
enter an address you control that has an account, and confirm the mail arrives. Check the
spam folder — a brand-new sending pattern from a Gmail account often lands there for the
first few messages.

☐ Tell MSID what now goes out in their name. Section 8 of the administrator's guide lists
it; the point they will care about is that approving a membership emails the applicant
immediately, so they no longer need to ring people.

## 2. Replace the sample content

☐ Work through the admin with MSID: Удирдах зөвлөл, Түүхэн замнал, Эмнэлзүйн заавар,
Эрдэм шинжилгээ, Түншүүд, and the Хуудсууд text.

☐ Delete or archive the demo records. They are recognisable by their slugs —
`demo-msid-congress`, `demo-endoscopy-course`, `demo-news-congress-open`. An event with
registrations cannot be deleted; archive it instead.

☐ Set the home page hero in Тохиргоо → Нүүр хуудас.

## 3. Accounts, before the domain

☐ Add `ibdmsid@gmail.com` as an owner on the **Vercel** project and the **Turso**
database.

This matters more than it looks. Both accounts are currently personal to you. If you and
MSID part ways, or you are simply unreachable for a fortnight, the site cannot be
redeployed, the database cannot be reached, and no backup would help — a backup of a
database nobody can restore into is a file. It costs nothing and takes five minutes.

☐ Create a second administrator account for MSID's own person, in Хэрэглэгчид, so the
site is not administered from one login.

## 4. Domain and going public

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

## 5. Once there is real data

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

From [AUDIT.md](AUDIT.md), in the order I would take them:

- **The registration page shows a participant's name and email to anyone holding the
  reference code.** Unguessable, `noindex`, and the same design an airline uses — but not
  rate-limited. Worth closing before a congress with a few hundred paying participants,
  not before.
- **Everything is rendered on demand.** Every visitor to the home page causes queries to
  Turso. Adding revalidation would make the public pages near-instant; admin saves already
  purge the cache, so nothing would go stale.
- **SVG uploads are allowed.** An SVG can carry script. Vercel Blob serves them from a
  different origin so they cannot touch the site, and only staff can upload — but if MSID
  never needs an SVG logo, removing the one line closes it entirely.

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

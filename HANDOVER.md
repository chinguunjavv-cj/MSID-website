# Handover

Written 6 August 2026, at commit `9cc5c06`, **plus one uncommitted change** — see "The
homepage in the working tree" below before doing anything else. `main` is what Vercel
deploys automatically.

This is the state of the work and the things that are not written down anywhere else.
For the ordered list of what still has to happen before launch, read
[LAUNCH.md](LAUNCH.md); for the security and quality findings, [AUDIT.md](AUDIT.md).
This document does not repeat either.

---

## Do this first

1. **Delete `.env.production.local`.** It is sitting in the repo root (gitignored, but
   on disk) and holds every production secret in plaintext — SMTP password, admin
   password, session secret, both database tokens. It was pulled with `vercel env pull`
   on 5 August to run imports. If the imports you need are done, it has no reason to
   exist: `rm .env.production.local`.

2. **Decide the fate of `fwdhi/`** — 27 MB of the original photographs MSID sent
   (Taiwan ×4, DD Week ×4, the President's portrait, the unattributed endoscopy group
   photo), currently untracked in the repo root. The import scripts are built to take
   originals, so "the imports are re-runnable" is only true while these files exist
   somewhere durable. Either commit them deliberately (27 MB of never-changing JPEGs is
   fine in git) or move them somewhere the next person can reach. Do not leave them
   untracked on one laptop, and do not let a reflexive `git add .` sweep them in
   undecided.

3. **Review the uncommitted homepage** — next section.

---

## The homepage in the working tree

`src/app/[locale]/(site)/page.tsx` carries an uncommitted redesign (+229/−126) that
**Chinguun has not yet approved**. It is the fourth iteration of the hero in one day,
and the history matters more than the diff:

1. Copper-drenched split hero (photo beside type) — *"not aesthetic"*.
2. Flat white, display-size headline — *"Not good"*.
3. White with an ink-50 band, headline shrunk to h1 — *"worse"*.
4. **Current, unreviewed:** the hero is one rounded photographic card, inset from the
   page, message set over a left scrim (caps society name in copper, tagline as the
   big line, two buttons); a slim copper next-event banner under it; a four-card
   quick-links grid with small hand-drawn stroke icons; About facts in a card; soft
   ambient shadows throughout.

Version 4 deliberately copies the composition of a Stitch mock Chinguun supplied twice
as his reference ("think of yourself as a senior UI designer of Dribbble") — its
structure and polish, **not** its navy/teal palette (he explicitly chose "lighten, keep
copper" when asked directly) and not its invented content. What was refused from the
mock and why: CME tracking, fellowships and annual congresses do not exist for this
society and nothing on this site is invented; "full text access to *Intestinal
Research*" is KASID's journal and **might actually be true** under the KASID
agreement — ask MSID, and if confirmed it is excellent membership-benefit copy.

What his reactions taught, for whoever designs next: he judges from screenshots, in
few words, and against polished consumer references. Flat hairline austerity — the
documented "clinical standards register" look — reads to him as unfinished, not as
restrained. Rounded corners (xl/2xl), soft shadows, card surfaces and small functional
icons are now deliberately in, on his instruction.

**DESIGN.md is now stale where it disagrees with this**: its hero clause (drenched
copper), shape rules (radius stops at 10px), elevation rules (no shadows), and the
"rules over cards" doctrine. If version 4 survives his review and ships, update
DESIGN.md to match reality; if he rejects it, `git checkout -- src/app/[locale]/(site)/page.tsx`
returns to the committed light split hero and DESIGN.md needs only the hero clause
revisited.

---

## What shipped this session (commits `c91c97c`…`9cc5c06`)

- **Membership page**: three grounds (paper → ink-50 → copper CTA band), category
  descriptions moved from hardcoded JSX into the dictionary.
- **President's letter**: portrait beside a three-line sign-off at the foot (the
  KASID-letter convention); `Prose` now preserves single newlines site-wide
  (`whitespace-pre-line`) — that fix is what un-collapsed the signature.
- **History**: the year no longer prints twice per row (`formatDayMonth` in
  `src/lib/format.ts`).
- **Guidelines register**: capped at `max-w-4xl` so the status pill sits with its
  record instead of stranded at the page edge.
- **Event galleries**: `EventGallery` is a crossfade carousel in the hero's dialect
  (7s, segments with elapsed-time fill, pause on hover/dialog, reduced-motion),
  no visible heading, click-to-enlarge dialog kept.
- **Event pages**: an event with no body/photos/programme shows an EmptyState instead
  of a void beside the registration sidebar.
- **Footer**: brand + contact only. Quick links duplicated the sticky masthead;
  partners duplicated the homepage section directly above. Chinguun's explicit call.
- **Import safety** (`scripts/import-event-photos.mts`): re-runs no longer overwrite
  alt text/captions unless flags are passed, and `sort` appends after the event's
  current highest instead of restarting at 1. Both fixes exist so a future admin
  editor's corrections survive re-imports.

## Production state — partly unverified

Done and confirmed on 5 August: **both leaked credentials rotated** (Blob and Turso,
via Vercel's managed rotation, zero-delay expiry — the handover item from 4 August is
closed). The Gmail app password still does not exist.

Done by Chinguun, **never verified from this machine** (the sandbox blocked curl and
deploys): the `vercel --prod` redeploy after rotation, and the Taiwan event import
against production. Before trusting either, check: the live site loads at all (proves
the redeploy), and `msidwebsite.vercel.app/en/events` lists `taiwan-mongolia-ibd-2024`
(proves the import). The board-portrait import for the President
(`npm run import:board -- --photo "Bayarmaa O.=fwdhi/IMG_7477.jpeg"`) was prepared but
never confirmed run — the greeting page shows her portrait only if production has it.

**Event photos exist only locally.** Production `event_photos` is empty. The local
database has Taiwan (IMG_1505/1496/1515) and DD Week (IMG_9547/9542) galleries — but
two rows carry colliding `sort=1` values from before the append fix, so clear and
re-import locally (or renumber) before treating local as the rehearsal for the
production run. Local also still has the demo rows — `npm run demo:clear` — which is
why screenshots keep showing a 2027 congress that does not exist.

## Mongolian pending Chinguun's review

- `Дэлгэрэнгүй мэдээлэл хараахан нийтлэгдээгүй байна.` (events.noDetails — composed
  from already-reviewed patterns, still new).
- The six photo alt texts written into the local gallery import (read off the
  photographs; the DD Week slide one names Э.Бат-Өлзий from the slide itself).

## Facts learned from the photographs, not yet acted on

- `Taiwan/IMG_1515` (auditorium group photo) is provably the Taiwan venue: its wall
  motto `ХҮН ЧАНАР БОЛ ДОТООД НЭР ТӨР` pairs with `НЭР ТӨР БОЛ ГАДААД ХҮН ЧАНАР`
  behind the banners in IMG_1519.
- `DD week/IMG_9547`: the slide names Bat-Ulzii E. (FCHM colorectal surgery head)
  presenting — a fact off the slide, safe to use.
- The 11 September front row: unconfirmed observation, the woman in the tan suit in
  IMG_1519 resembles the President's portrait and the same person sits at the chairs'
  table in IMG_9551. **Do not ship this** — it is face-recognition inference; ask MSID,
  who should also be asked the panel name plates (CHEIN-CHIH TUNG, O.ANAR,
  …URNULTSAIKHAN).
- The endoscopy group photo (`fwdhi/International_event.JPG`) remains unattributed —
  still nowhere honest to put it.

## Still missing, still true from last time

The event-photo admin editor (alt text and captions are script-only until it exists —
follow the fees/sessions pattern on the event edit page, **not** the resource
registry); the Gmail app password; a domain; bank details; 14 of 16 board portraits;
the remaining page text. The "Things that will bite you" and "Going public" sections
of the 4 August handover remain accurate — MIGRATIONS array, `auditTx` inside
transactions, `MSID_SITE_URL`, no stray exports from `"use server"` modules, admin
guide sourced from `docs/admin-guide.html`, and the noindex mechanism.

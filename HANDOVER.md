# Handover — 8 August 2026

One long design session with Chinguun, working through the public site. **Nothing is
committed.** 22 modified files, ~785 insertions. Typecheck clean, every public page
returns 200 in both locales.

---

## The decision that governs everything else

The site was running **two visual languages at once** — the flat "register" (hairlines,
tabular numerals) and a card language (rounded corners, shadows, tinted grounds). Each
pass had been adding to one or the other, so nothing was wrong on its own and the whole
read as noise. Chinguun's words: *"The website design is now mess."*

It is now committed to **Restrained**:

- **Paper is the ground.** Structure comes from hairlines and type, not from cards,
  shadows or tints.
- **Copper is the only accent.** Ink is reserved for the masthead strip and the footer —
  the frame around the page, never a section inside it.
- One radius (`rounded-lg`), **zero shadows** on the public site, one section rhythm
  (`py-12 md:py-16`).

Measured before → after: 6 tinted surfaces → 1; 3 radii → 1; 2 shadow recipes → 0;
4 spacing values → 1; 12 text styles → 10.

**DESIGN.md is stale.** It still documents "Strategy: Committed" with copper occupying
whole surfaces, a drenched hero, square corners and no shadows. None of that is true
now. Rewriting it is the single highest-value cleanup left.

---

## What Chinguun decided (do not silently re-litigate)

These were argued, some more than once. He reaffirmed each; treat them as settled.

| Decision | Note |
|---|---|
| **No photograph in the hero** | Type only. The photographs moved beside the introduction |
| **No guidelines register section on the landing page** | His reasoning: the register serves researchers, a narrower audience than the landing page. I argued against this twice — he reaffirmed with audience reasoning I don't have better information on |
| **No membership section on the landing page** | Reachable from the hero button and the menu |
| **Both hero buttons stay** | Гишүүнээр элсэх + Эмнэлзүйн заавар |
| **Commissioner, not Nunito** | Nunito was tried and reverted — rounded terminals read friendly, wrong for a clinical standards body |
| **Plus Jakarta Sans is impossible** | Ships `cyrillic-ext` but **not** base `cyrillic`, so А–я would fall back to a system font while only Ө/Ү rendered in the brand face. Verified in `node_modules/next/dist/compiled/@next/font/dist/google/font-data.json` — check that file before ever proposing a font |
| **Filled copper is `copper-600`, not 700** | 700 is a step darker than the logo and reads brown; 600 ≈ the logo body `#A85423`, and passes AA at 5.16:1 |
| **Bottom tab bar on mobile** | Was gated on `pointer: coarse` so it was invisible in every desktop browser — now width-based |

**He notices duplication instantly.** Three separate duplications were caught this
session (quick-link cards repeating the sections below them verbatim; the empty-events
notice appearing in both hero and congress section; the mobile menu listing each
section's landing page twice because every parent's `href` *is* its first child's).
A DOM sweep for repeated strings now returns empty — worth re-running after any change.

---

## Current homepage

```
Hero  →  Нийгэмлэгийн тухай + photo gallery  →  Их хурал, сургалт  →  Түншүүд
```

The hero is the last thing touched and **is unreviewed**. It got, in response to *"the
background is just white wall"*:

- an `ink-50` ground with a hairline bottom (the page's only tinted surface)
- a faint ruled texture (`.ruled` in globals.css) using the same hairline and rhythm as
  `.register-row`, masked to the **right** half where the emptiness actually is —
  ruling through the headline read as lined notebook paper; disabled below 48rem
- a short copper hairline above the headline

Chinguun has not seen this. It may need cutting back.

---

## Work still open

1. **Partner logos** — `partners.logo` exists in the schema and is empty for KASID, AOCC
   and ECCO. Rendering is wired: a logo replaces the acronym, no logo keeps the text, no
   grey placeholder either way. Needs uploads via admin.
2. **`unte_logo/` is untracked in the project root** — ~4.5MB of `.ai`/`.eps`/PNG design
   source. Only `Logo-05.png` was copied to `public/brand/unte-logo.png`. Move it out or
   gitignore it before committing.
3. **PRODUCT.md contradicts the site** — it names the primary user job as "find the
   current MSID position on a clinical question", but the guidelines register is no
   longer on the landing page.
4. **Open audit findings**: `aria-haspopup` missing on desktop dropdown triggers; utility
   strip links are 66×29px and contact `tel:`/`mailto:` links 19px (under 44px); dates
   built with `padStart` rather than `Intl.DateTimeFormat`; `HeroCarousel.tsx` is dead
   code with zero importers, and `--animate-hero-progress` exists only for it.
5. **36 arbitrary `text-[…rem]` values** still bypass existing tokens (`text-[0.8125rem]`
   ×25 *is* `--text-label`).
6. **Semantic token layer** — discussed, not done, deliberately. `ink-600` is written 110
   times, `ink-200` 66, `copper-700` 45. Worth doing when dark mode or another palette
   change comes up; invisible on screen, so it was not the priority.

---

## Two traps that cost real time

**`curl` returning 200 does not mean the page works.** Next renders its error boundary
with a 200 status. A broken SQL query in `listSocietyPhotos` passed every status check
and only surfaced when the page was opened in a browser. Check for the error boundary
string, or look.

**The Browser pane paints stale and blank frames constantly.** Verify through computed
styles and `getBoundingClientRect` rather than screenshots. Several times a screenshot
showed a grey headline or an empty page while the DOM was correct. Also: Chinguun spent
much of the session looking at **cached pages** and reporting "nothing has changed" —
tell him to hard-reload (`Cmd+Shift+R`), a normal reload keeps Next's hashed CSS chunks.

**JSX comments cannot sit beside a root element or inside a prop expression.** Broke the
build three times this way. Put them above the `return`.

---

## Skills

`impeccable` and `design-house-rules` are fully installed and were used throughout.

`ui-ux-pro-max`, `ui-styling`, `design-system`, `brand`, `banner-design` and `slides` all
arrived as **SKILL.md only** — one file each, no `scripts/`, no `references/`, no data.
They are pointer skills whose substance did not ship; `ui-ux-pro-max`'s 192 palettes and
74 font pairings are not queryable. Do not pretend otherwise to the user; he has asked
about this repeatedly and been told each time. `web-design-guidelines` **is** complete —
it fetches Vercel's rules live and was used for the UX audit.

House rules that bit this session: *at most 2 font families*; *icons in coloured circles
→ use a text label, a number, or nothing*; *visible text styles stay limited*; *a silent
deviation is a bug*.

# Design

Visual system for the MSID website. Companion to [PRODUCT.md](PRODUCT.md), which owns
strategy. This file owns how it looks.

## Theme

**Light, with an ink-grounded structure and a copper-drenched voice.**

The scene that forces this: a gastroenterologist at 07:00 in a hospital corridor in
Ulaanbaatar, phone in one hand, checking whether the MSID position on biologic therapy has
been updated before rounds. Bright ambient light, small screen, no patience. That is a
daylight reading surface, not a dark one — and it is a document, not a dashboard.

The aesthetic lane is **clinical standards register**: the visual language of a national
guideline booklet and a drug label. Precise rules, dated records, tabular numerals, status
that is stated rather than implied. Deliberately *not* the editorial-magazine lane, *not*
the medical-blue lane, *not* SaaS.

## Color

**Strategy: Committed.** Copper carries the brand and occupies whole surfaces — the hero,
the congress block, section grounds — rather than appearing as a 5% accent. Ink carries
structure (masthead, footer, headings). White carries reading.

Copper is not an aesthetic choice; it is MSID's actual identity, taken from the logo's
burnt-sienna intestine and gold wordmark. Identity preservation wins over any palette
generator here.

All values are OKLCH.

### Brand — copper

Sampled from the logo's intestine gradient (highlight `#C8763C`, body `#A85423`,
shadow `#7B3A12`).

| Token | Value | Use |
|---|---|---|
| `--color-copper-50` | `oklch(0.968 0.012 50)` | Tinted section grounds |
| `--color-copper-100` | `oklch(0.930 0.028 50)` | Hover fills, badges |
| `--color-copper-200` | `oklch(0.872 0.052 50)` | Borders on tinted ground |
| `--color-copper-300` | `oklch(0.795 0.083 50)` | Dividers inside drenched panels |
| `--color-copper-400` | `oklch(0.700 0.112 50)` | Text on ink; decorative marks |
| `--color-copper-500` | `oklch(0.618 0.132 48)` | Logo highlight; large-text only on white |
| `--color-copper-600` | `oklch(0.545 0.134 46)` | **Primary.** Drenched grounds |
| `--color-copper-700` | `oklch(0.462 0.115 44)` | Buttons, inline links on white |
| `--color-copper-800` | `oklch(0.385 0.094 43)` | Button hover, pressed |
| `--color-copper-900` | `oklch(0.315 0.075 42)` | Deep ground |

### Brand — gold

From the `MSID` wordmark. **Used sparingly** — the society's marque, membership status,
and honours. Never as a general accent; it is the second voice, not a second brand colour.

| Token | Value | Use |
|---|---|---|
| `--color-gold-400` | `oklch(0.795 0.118 82)` | On ink only |
| `--color-gold-500` | `oklch(0.705 0.132 79)` | Wordmark |
| `--color-gold-600` | `oklch(0.615 0.118 74)` | On white, large text only |

### Neutrals — ink

Chroma 0.002–0.016 toward copper's hue (45). Deliberately not tinted "warm by default"
and deliberately **not in the cream band** — there is no beige, sand, or parchment surface
anywhere in this system. `--color-paper` is effectively white.

| Token | Value | Contrast on paper | Use |
|---|---|---|---|
| `--color-ink-950` | `oklch(0.175 0.014 45)` | 17.5:1 | Masthead, footer, hero ground |
| `--color-ink-900` | `oklch(0.235 0.016 45)` | 15.4:1 | Headings |
| `--color-ink-800` | `oklch(0.310 0.014 45)` | 13.0:1 | Strong body |
| `--color-ink-700` | `oklch(0.400 0.012 45)` | 9.1:1 | **Body text default** |
| `--color-ink-600` | `oklch(0.500 0.010 45)` | 5.9:1 | **Muted floor.** Captions, meta |
| `--color-ink-500` | `oklch(0.585 0.009 45)` | 4.1:1 | ✗ Never prose. Icons, large text |
| `--color-ink-400` | `oklch(0.700 0.007 45)` | — | Disabled, placeholder marks |
| `--color-ink-300` | `oklch(0.815 0.005 45)` | — | Strong rules |
| `--color-ink-200` | `oklch(0.895 0.004 45)` | — | **Default rule / border** |
| `--color-ink-100` | `oklch(0.945 0.003 45)` | — | Subtle fills, table stripes |
| `--color-ink-50` | `oklch(0.975 0.002 45)` | — | Section ground |
| `--color-paper` | `oklch(0.995 0.001 45)` | — | Page background |

**The `ink-500` line is the one rule that gets broken by accident.** Muted prose stops at
`ink-600`. Anything lighter is decoration, not text.

### Semantic — record status

Status is never carried by colour alone; every state also carries a word.

| Token | Value | Meaning |
|---|---|---|
| `--color-status-active` | `oklch(0.520 0.115 155)` | Published, paid, confirmed, current member |
| `--color-status-pending` | `oklch(0.620 0.135 75)` | Awaiting payment, under review, draft |
| `--color-status-expired` | `oklch(0.520 0.150 25)` | Lapsed, cancelled, superseded, closed |
| `--color-status-info` | `oklch(0.500 0.105 245)` | Informational only — the single non-brand hue |

`--color-status-info` is the only blue in the system, restricted to neutral notices, so
that the site never drifts into the medical-blue lane.

## Typography

Selected under a hard constraint: **complete Mongolian Cyrillic**, including Ө ө Ү ү. Both
families ship the `cyrillic-ext` subset, which was verified against the Google Fonts CSS
before selection rather than assumed.

Paired on a contrast axis — humanist sans against reading serif — and deliberately
inverted from the category reflex: the **sans carries display and structure** (the way a
standards document sets its cover and section headers) and the **serif carries long-form
reading** (the way its body text is set). No display serif italics, no drop caps.

| Role | Family | Weights | Applied to |
|---|---|---|---|
| Display & UI | **Commissioner** | 300–800 variable | Headings, nav, buttons, labels, tables, data |
| Reading | **Literata** | 400–600 variable | Guideline body, welcome message, history, abstracts |

Neither family appears on the reflex-reject list. No monospace anywhere — MSID is not a
technical brand, and mono would read as costume.

### Scale

Fluid `clamp()`, ratio ≥ 1.25. Display maximum is **4.5rem (72px)**, well under the 6rem
ceiling — a standards body states its name, it does not shout it.

| Step | Size | Tracking | Use |
|---|---|---|---|
| `display` | `clamp(2.5rem, 1.6rem + 3.6vw, 4.5rem)` | `-0.03em` | Hero only |
| `h1` | `clamp(2rem, 1.4rem + 2.4vw, 3.25rem)` | `-0.025em` | Page title |
| `h2` | `clamp(1.5rem, 1.2rem + 1.2vw, 2.25rem)` | `-0.02em` | Section |
| `h3` | `clamp(1.25rem, 1.1rem + 0.6vw, 1.5rem)` | `-0.015em` | Subsection |
| `body` | `1.0625rem` / `1.65` | `0` | Interface prose |
| `read` | `1.1875rem` / `1.75` | `0` | Literata long-form |
| `small` | `0.9375rem` / `1.55` | `0` | Meta, captions |
| `label` | `0.8125rem` / `1.4` | `0.01em` | Form labels, table headers |

Letter-spacing floor `-0.03em`, above the `-0.04em` limit. `text-wrap: balance` on h1–h3,
`text-wrap: pretty` on prose. Measure capped at **68ch**.

Mongolian Cyrillic runs roughly 10–15% longer than English at the same point size and has
a taller x-height in these families. Headline `clamp()` maxima are set so the **Mongolian**
string fits at every breakpoint — the language that overflows is the one that sets the size.

Numerals: `font-variant-numeric: tabular-nums` on all dates, fees, counts, and table
columns. Dates align in a column or they are not a register.

## Layout

- **Grid.** 12 columns, `clamp(1.25rem, 4vw, 2.5rem)` gutters, `max-width: 1200px` for
  structure and `68ch` for prose. Full-bleed sections escape via a `.bleed` utility.
- **Spacing.** 4px base. Rhythm is varied deliberately: `space-24`/`space-32` between
  major sections, `space-2`/`space-3` inside a record row. Uniform spacing reads as a
  template.
- **Rules over cards.** The default container is a horizontal rule and a row, not a card.
  Cards appear only where an item is genuinely a discrete object with an image (an event, a
  publication cover). Never nested.
- **The register row** is the signature component: date column, title, status pill,
  optional version — aligned on a shared baseline grid, tabular numerals, hairline rules.
  Used for guidelines, deadlines, past events, and the member roll.
- Responsive grids use `repeat(auto-fit, minmax(280px, 1fr))`; no breakpoint soup.
- **Z-index scale** (semantic, never arbitrary): `base 0` → `raised 10` → `dropdown 20` →
  `sticky 30` → `backdrop 40` → `modal 50` → `toast 60` → `tooltip 70`.

## Components

- **Masthead.** Two tiers, not one: a thin `ink-950` utility strip (society name,
  member/admin links, `МН / EN`) over a paper bar carrying the mark, the wordmark, and
  the five menus. The split is not decoration — MSID's logo is copper artwork on white,
  so it needs a light ground to read cleanly, while the ink tier keeps the structural
  weight and moves the account controls out of the navigation. Sticky; the active menu
  carries a copper underline. Mobile: full-height sheet, not a cramped dropdown.
- **The mark.** The supplied logo is a JPEG with a white ground and the `MSID` wordmark
  beneath the artwork. `MsidMark` crops the wordmark away (a 320 × 234 window over a
  square image) and drops the white ground with `mix-blend-mode: multiply`. Opacity must
  be set on the image itself, never an ancestor — opacity on a parent creates a stacking
  context, which isolates the blend and leaves a pale rectangle. The mark therefore only
  works on light or copper grounds; on ink, use the paper tile in the footer.
- **Buttons.** `copper-700` ground, white text (6.9:1), `radius-sm` (4px). Secondary is an
  ink outline. Tertiary is an underlined text link. No pill buttons, no gradients, no glow.
- **Status pill.** Square-ish (`radius-xs`), tinted ground, semantic text colour, always
  with a word. Never a bare coloured dot.
- **Forms.** Labels above inputs, always visible. 1px `ink-300` border, 2px `copper-600`
  focus ring at 2px offset. Errors are stated in words beneath the field and referenced
  from a summary at the top. Placeholder text at `ink-600`, never lighter.
- **Tables.** Real `<table>` with `<caption>` and scope; `ink-100` header ground, hairline
  rows, tabular numerals, horizontally scrollable inside their own container on mobile.
- **Empty states.** Every list says what will appear here and what the administrator
  should do next — in the visitor's language. A young society has empty sections; they
  should read as "not yet published", never as broken.

## Imagery

Documentary, not promotional. Endoscopy suites, congress halls, Ulaanbaatar — real rooms
where the work happens. Never smiling doctors with folded arms, never stethoscope
close-ups, never a handshake.

Hero and section photography is treated with an `ink-950` multiply overlay so it reads as
institutional record rather than stock cheer, and so overlaid type always clears 4.5:1.
Alt text is specific and in the page's language.

Sourced from Unsplash at `?auto=format&fit=crop&w=1600&q=80`; every photo ID is verified
to resolve before it ships.

## Motion

Restrained and deliberate. One orchestrated settle on first load — masthead, then hero
title, then the primary action — and nothing else that fires on every section.

- Easing: `--ease-out-quart` `cubic-bezier(0.165, 0.84, 0.44, 1)`. No bounce, no elastic.
- Durations: `120ms` state change, `240ms` element, `420ms` page transition.
- Only `transform`, `opacity`, `clip-path`, and `filter` animate. Never layout properties.
- Reveals enhance an already-visible default: content is never gated behind a class-
  triggered transition, so it renders in headless and background tabs.
- `@media (prefers-reduced-motion: reduce)` collapses every animation to an instant state
  change or a 100ms crossfade. Not an afterthought — written alongside each animation.

## Admin & portal (product register)

The admin follows [reference/product.md](.claude/skills/impeccable/reference/product.md)
rather than this file's brand rules. It shares the tokens, the type families, and the
register row, and diverges on everything else:

- Denser scale (`body` at `0.9375rem`), tighter spacing, no display type, no imagery.
- Ink-neutral chrome. Copper is reserved for the primary action and the active nav item —
  no drenched surfaces.
- Every bilingual field is a paired `МН` / `EN` input with the pair visible at once, so
  the administrator can see when one language is missing.
- Destructive actions confirm by name. Save state is always visible.

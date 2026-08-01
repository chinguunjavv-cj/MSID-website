# Product

## Register

brand

The public site is the primary surface and is a brand register: for most visitors, this
site *is* MSID. The `/admin` platform and `/portal` member area are a product register —
they serve a workflow and follow `reference/product.md` rules instead.

## Users

**Mongolian gastroenterologists and IBD clinicians** — the core audience. Reading on a
phone before ward rounds, or on a hospital desktop between clinics. They come with one
of three jobs: find the current MSID position on a clinical question, find out when the
next congress or training is and register for it, or manage their own membership.

**Residents and young specialists** — deciding whether MSID is worth joining. They need
to see that the society is active, that membership gets them something concrete
(training, case conferences, congress rates), and that joining takes two minutes.

**International partner societies** — KASID, AOCC, ECCO, RAPID, and the Asia-Pacific IBD
network. They arrive in English, usually from a link in an email or a partner site, and
are evaluating MSID as a credible counterpart. They need the English site to be complete,
not a thin translation of the Mongolian one.

**Patients and the public** — a secondary but real audience. MSID's own stated mission
includes delivering reliable information to the public. They need plain-language material
that does not require a medical degree.

**MSID's administrator** — a physician, not a developer, editing content between clinical
duties. Every change to the site must be possible through the admin UI in both languages,
without touching code and without a training course.

## Product Purpose

MSID (Монголын Гэдэсний Эмгэг Судлалын Нийгэмлэг) was founded on 5 March 2024 by the
initiative of specialist physicians, to develop the study of intestinal disease in
Mongolia systematically. It is a young NGO building a national standard where one did not
previously exist in organised form.

The site exists to do three things:

1. **Publish the standard.** MSID's clinical guidelines and consensus statements, dated
   and versioned, as the authoritative Mongolian reference for intestinal disease.
2. **Run the society's calendar.** Congress, training programmes, and case conferences —
   announced, and registrable, with payment tracked to completion.
3. **Hold the membership.** A member roll that the society can actually see and manage,
   replacing an implicit Facebook following of 342 with a real register.

Success looks like: a Mongolian clinician checks this site rather than asking a colleague;
a partner society links to it rather than to the Facebook page; and the administrator
never needs to ask a developer to change anything.

## Brand Personality

**Clinical authority.** Precise, evidence-first, quietly confident.

Three words for the physical object this site should feel like: **precise, durable,
plainspoken.** It is a national clinical standards document — offset-printed, meant to be
annotated in the margin and still legible in five years — not a brochure and not a
product launch.

Voice: declarative and specific. State the date, the version, the venue, the fee, the
deadline. Never "empowering healthcare" or "committed to excellence." A society that sets
standards writes like one: it says what is true and when it was decided.

Bilingual is not decoration. Mongolian is the default and the primary language; English
is a full peer, not a courtesy translation. Never mix the two in one interface.

Emotional goal: a clinician should feel that the information here can be relied on in
front of a patient.

## Anti-references

All four were named explicitly by the client. Every one is a live risk for this category.

- **Dated Korean/Japanese society sites.** Cramped 12px text, table-based layout, clip-art
  icons, competing banner carousels, popup notice windows. KASID's own site is partly this;
  it is the structural reference, never the visual one.
- **Generic SaaS landing page.** Gradients, floating 3D shapes, "Get Started Free",
  hero-metric rows of big numbers, identical three-card feature grids.
- **Hospital marketing brochure.** Stock photos of smiling doctors with folded arms, soft
  blue gradients, rounded corners everywhere, stethoscope imagery.
- **Cold government portal.** Grey, dense, form-first, zero personality — technically
  correct and completely forgettable.

Two more, inferred, that the category pulls toward:

- **Editorial-magazine affectation.** Display serif italic + mono labels + ruled columns +
  drop caps. A society is not a magazine; borrowed literary polish reads as costume.
- **National-symbol palette.** Mongolian flag blue and gold, soyombo motifs as decoration.
  The cultural reading comes from the language, the typography and the content — not from
  waving the flag.

## Design Principles

1. **The register is the design.** Guidelines, congress deadlines, and the member roll are
   presented as precise, dated, versioned records — the way a standards body publishes.
   Information density is the brand asset, not a problem to hide behind cards.
2. **State the fact, not the feeling.** Every headline carries a date, a number, a status
   or a name. If a sentence would survive being moved to a different society's site, it is
   not written yet.
3. **Mongolian first, English equal.** The default locale is `mn`. Any feature that works
   in one language works identically in the other, including admin-authored content. No
   half-translated page ever ships.
4. **Earned, not inherited, authority.** MSID is two years old. The site should read as
   rigorous rather than as venerable — no fake heritage, no borrowed gravitas, no
   invented history.
5. **The administrator is a physician.** Every content surface is editable through the
   admin in both languages. If changing something requires code, the design is wrong.

## Accessibility & Inclusion

Target **WCAG 2.2 AA**. This is a public-health body in a country with a small specialist
community and a wide age range among practising clinicians; accessibility is a
professional obligation, not a checkbox.

- Body text ≥ 4.5:1 contrast, large text ≥ 3:1, UI boundaries ≥ 3:1. Muted text uses the
  `ink-600` step or darker — never `ink-500` or lighter for prose.
- Full keyboard operability with a visible focus ring on every interactive element.
  Skip-to-content link on every page.
- `prefers-reduced-motion: reduce` honoured with a real alternative for every animation.
  No content is revealed only by a scroll-triggered transition.
- **Mongolian Cyrillic must render correctly**, including Ө ө Ү ү (U+04E8/04E9,
  U+04AE/04AF). Every font must ship the `cyrillic-ext` subset; this is verified visually,
  not assumed.
- Language changes are marked with `lang` and `hreflang`. Locale switching preserves the
  current page.
- Colour is never the sole carrier of meaning — registration and payment states carry a
  label as well as a colour.
- Realistic network conditions: this is used on hospital wifi and mobile data in
  Ulaanbaatar. Pages must be useful before JavaScript finishes.

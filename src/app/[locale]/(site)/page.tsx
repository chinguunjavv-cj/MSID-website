import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { tr } from "@/lib/db/types";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  featuredEvent,
  getPage,
  listPartners,
  listPublishedNews,
  listUpcomingEvents,
  listSocietyPhotos,
} from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import {
  formatDate,
  formatDateNumeric,
  formatDateRange,
  daysUntil,
  todayIso,
} from "@/lib/format";
import { EmptyState, Prose, ProseList, SectionHead } from "@/components/ui/Primitives";
import { EventRow_, NewsRow } from "@/components/site/records";
import { EventGallery } from "@/components/site/EventGallery";
import { PartnerMarquee } from "@/components/site/PartnerMarquee";
import { safeFileHref } from "@/lib/video";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const settings = await getSettings();
  const p = (path: string) => localePath(locale, path);

  /*
    Issued together, not one after another. Against a hosted database each of these is
    a network round trip, so awaiting them in sequence would make the home page seven
    round trips deep for no reason — none of them depend on each other.
  */
  const [
    upcoming,
    featured,
    news,
    partners,
    aboutPage,
    societyPhotos,
    benefits,
  ] = await Promise.all([
    listUpcomingEvents(4),
    featuredEvent(),
    listPublishedNews(4),
    listPartners(),
    getPage("home.about"),
    // The photographs beside the introduction. Eight is two full turns of the gallery.
    listSocietyPhotos(8),
    getPage("membership.benefits"),
  ]);

  const heroHeadline =
    (locale === "mn" ? settings.hero_headline_mn : settings.hero_headline_en) ||
    t.org.name;
  const heroLead =
    (locale === "mn" ? settings.hero_lead_mn : settings.hero_lead_en) ||
    t.org.tagline;
  const heroAlt =
    (locale === "mn"
      ? settings.hero_image_alt_mn
      : settings.hero_image_alt_en) || "";

  /*
    The photographs beside the introduction. An administrator's dedicated hero image, if
    one is set, still has a home — it leads the gallery rather than being stranded now
    that the hero carries no picture.

    Every caption states the event and its date, so a photograph is never shown as
    decoration: the visitor is told what they are looking at and when it happened.
  */
  const galleryPhotos = [
    ...(settings.hero_image
      ? [
          {
            id: "hero",
            image: settings.hero_image,
            alt: heroAlt,
            caption: heroAlt,
          },
        ]
      : []),
    ...societyPhotos.map((photo) => ({
      id: photo.id,
      alt: tr(photo, "alt", locale) || tr(photo, "title", locale),
      image: photo.image,
      caption: [
        tr(photo, "caption", locale) || tr(photo, "title", locale),
        [formatDateRange(photo.starts_on, null, locale), tr(photo, "city", locale)]
          .filter(Boolean)
          .join(" · "),
      ]
        .filter(Boolean)
        .join(" — "),
    })),
  ];

  const next = featured ?? upcoming[0];
  const nextDays = next ? daysUntil(next.starts_on) : null;

  /* Nothing featured and nothing upcoming — the congress section is a notice, not a list. */
  const otherUpcoming = upcoming.filter((event) => event.id !== featured?.id);
  const congressEmpty = !featured && otherUpcoming.length === 0;

  /*
    The hero card reads caps-label → statement, the way an institution's cover does.
    The caps line is always the Society's name; the statement is the tagline — unless
    an administrator has written a custom headline, which then takes the big type and
    pushes the tagline down to a supporting sentence.
  */
  const customHeadline = heroHeadline !== t.org.name;
  const heroTitle = customHeadline ? heroHeadline : heroLead;
  const heroSub = customHeadline ? heroLead : "";

  /*
    Through `safeFileHref`, not read raw: the setting is staff-editable text, and a
    malformed value fed straight to next/image throws at render — a whole home page
    down for a typo in one admin field. Filtered, a bad value simply falls back to
    the typographic hero until the field is fixed.
  */
  const heroBackground = safeFileHref(settings.hero_background);

  /*
    The countdown gauge in the hero panel. Thirty days is the dial's full sweep — long
    enough that a congress announced a month out starts to fill, short enough that the
    last fortnight reads as urgent.
  */
  const COUNTDOWN_WINDOW_DAYS = 30;
  const RING_RADIUS = 44;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
  const countdownFraction =
    nextDays === null || nextDays <= 0
      ? 1
      : Math.min(1, Math.max(0, (COUNTDOWN_WINDOW_DAYS - nextDays) / COUNTDOWN_WINDOW_DAYS));

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* Hero — the Society's purpose, stated                              */}
      {/* ---------------------------------------------------------------- */}
      {/*
        Type only, no photograph (Chinguun's call, August 2026). The Society's
        photographs moved down to sit beside the introduction, where they document what
        the text claims; up here a single sentence at display scale says what MSID exists
        to do. For a body whose product is a written standard, the statement *is* the
        picture — and nothing has to be scrimmed to stay legible over it.

        An empty `hero_background` still renders exactly the hero described above; the
        setting is the opt-in for a licensed photograph, and the Society took it on
        31 August 2026 with the red steppe escarpment now seeded as the default
        (`settings-defaults.ts` has the licence note). Clearing the field in Тохиргоо
        is the way back.

        With a photograph the hero flips to the system's dark register — DESIGN.md's
        one prescribed photo treatment: "hero and section photography is treated with
        an ink-950 multiply overlay so it reads as institutional record rather than
        stock cheer." Three light fades were tried first and every one read as a washed
        print, because a white veil fights a photograph where shadow beds it in. The
        ground becomes ink-950 (the token table's own "masthead, footer, hero ground"),
        the statement is set in paper, and the fade runs into shadow: deepest under the
        text, thinnest over the escarpment, which keeps its full colour — darkening
        saturates a photograph where whitening bleaches it. The image stays mirrored
        (scale-x) so the red rock faces the open half; decorative by construction,
        aria-hidden, empty alt.

        The crop and the scrims are tuned to this photograph. Change the setting and
        look at the band before shipping: the interior banner needed a 25% scrim and a
        crop three quarters down for its own photograph, where this one wants 30% and
        the ridge.
      */}
      {/* overflow-hidden only with a photograph to clip: without one the markup is
          byte-for-byte what it was before this setting existed. */}
      <section
        className={`relative border-b border-ink-200 ${
          heroBackground ? "overflow-hidden bg-ink-950" : "bg-ink-50"
        }`}
      >
        {heroBackground && (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <Image
              src={heroBackground}
              alt=""
              fill
              priority
              sizes="100vw"
              className="-scale-x-100 object-cover object-[50%_30%]"
            />
            {/* The record tone: a flat bed of shadow, heavier on a phone where the
                text owns the whole width. The desktop band is short and crops the
                photograph to a narrow slice, so its bed stays thin and the crop is
                biased up to the ridge line (object-position above), where the light is. */}
            <div className="absolute inset-0 bg-ink-950/40 md:bg-transparent" />
            {/* The fade — into shadow, never into white. Deepest where the statement
                sits, gone entirely over the rock. Settled here after four rounds with
                the Society, one step at a time from 90/50: light enough that the
                whole frame reads as photograph, dark enough that the paper statement
                never hunts for its ground. */}
            <div className="absolute inset-0 bg-gradient-to-r from-ink-950/60 via-ink-950/30 via-45% to-transparent" />
          </div>
        )}

        {/*
          The ruled ground, behind everything and inert to the pointer — only on the
          typographic hero. Hairlines over a photograph read as scan artefacts, and the
          photograph is already doing the job the rules did: giving the statement a ground.
        */}
        {!heroBackground && (
          <div aria-hidden className="ruled pointer-events-none absolute inset-0" />
        )}

        <div className="shell relative pt-12 pb-12 md:pt-20 md:pb-16">
          {/* The Society's colour, one hairline of it, the way a masthead rules a page.
              copper-400 on the photographic ground — the token for marks on ink. */}
          <span
            aria-hidden
            className={`animate-settle block h-0.5 w-12 ${
              heroBackground ? "bg-copper-400" : "bg-copper-600"
            }`}
          />

          {/*
            Semibold on the photograph, bold on the typographic hero. Over the record
            ground the photograph shares the stage, and 700-weight paper at display
            scale shouted from it; 600 states the same sentence. Without a photograph
            the type is the whole picture and keeps its full weight.
          */}
          <h1
            className={`animate-settle mt-7 max-w-[18ch] text-display text-balance ${
              heroBackground
                ? "font-semibold text-paper"
                : "font-bold text-ink-950"
            }`}
          >
            {heroTitle}
          </h1>

        {heroSub && (
          <p
            className={`animate-settle mt-7 max-w-[56ch] text-lg leading-relaxed ${
              heroBackground ? "text-paper" : "text-ink-700"
            }`}
            style={{ animationDelay: "80ms" }}
          >
            {heroSub}
          </p>
        )}

        {/*
          Both destinations, because the hero now carries them alone: the guidelines
          register and the membership pitch are no longer sections further down the page
          (Chinguun's call, August 2026 — the register speaks to a narrower audience than
          the landing page serves, and membership is one click from here or the menu).
        */}
        {/*
          One row on a phone, at their natural width. Stretching them to half the row
          each (`flex-1`) fitted them side by side but made two large slabs of a hero
          that is meant to be mostly the statement; with the trimmer mobile button both
          labels fit as they are.
        */}
        <div
          className="animate-settle mt-8 flex gap-2.5 sm:gap-3"
          style={{ animationDelay: "140ms" }}
        >
          <Link href={p("/membership")} className="btn btn-primary">
            {t.home.joinCta}
          </Link>
          {/* On the photograph, the system's on-dark button: paper ground, ink text —
              the white the ink outline cannot be over rock. */}
          <Link
            href={p("/guidelines")}
            className={`btn ${heroBackground ? "btn-on-dark" : "btn-secondary"}`}
          >
            {t.nav.guidelines}
          </Link>
        </div>

        {/*
          What is next — and only when there is a next. The empty case used to render
          "Одоогоор товлогдсон арга хэмжээ байхгүй байна." here, which is word for word
          what the congress section says further down, where it also explains what will
          appear and offers a way to hear about it. A strip that announces a live fact
          has nothing to say when there is no fact.
        */}
        {/*
          The panel, not the chip it replaced. That was a copper-50 sticker built for a
          paper hero, and once the hero became a photograph it sat on the rock like a
          label peeled off something else. This is a plate on the record: the Society's
          next date, stated, with the count as a tabular numeral — the one typographic
          move DESIGN.md reserves for dates and figures, and a truer countdown than a
          ring, whose sweep would have to stand for a span nobody has agreed on.

          Deliberately not the reference mockup's glass: no backdrop blur, no 24px
          radius, no second typeface. A translucent ink plate over the photograph reads
          as part of the same record; frosted glass reads as a widget laid on top.
        */}
        {next && (
          <Link
            href={p(`/events/${next.slug}`)}
            className={`group animate-settle mt-10 flex flex-col gap-5 rounded-lg border px-6 py-5 transition-colors duration-100 md:mt-12 md:flex-row md:items-center md:justify-between md:gap-8 md:px-8 md:py-6 ${
              heroBackground
                ? "border-white/15 bg-ink-950/75 hover:border-copper-400/70"
                : "border-copper-200 bg-copper-50 hover:border-copper-600"
            }`}
            style={{ animationDelay: "200ms" }}
          >
            <div className="min-w-0">
              <span
                className={`text-[0.75rem] font-semibold uppercase tracking-wide ${
                  heroBackground ? "text-copper-400" : "text-copper-800"
                }`}
              >
                {t.events.upcoming}
              </span>

              <p
                className={`mt-1.5 max-w-[46ch] text-h3 font-semibold text-balance ${
                  heroBackground ? "text-paper" : "text-ink-900"
                }`}
              >
                {tr(next, "title", locale)}
              </p>

              <p
                className={`mt-2 text-small tabular ${
                  heroBackground ? "text-ink-300" : "text-ink-600"
                }`}
              >
                {formatDateRange(next.starts_on, next.ends_on, locale)}
                {tr(next, "city", locale) && ` · ${tr(next, "city", locale)}`}
              </p>

              {/*
                Only while the call is actually open. The deadline is the one thing on
                this page a reader can act on today, and it closes on its own date.
              */}
              {next.abstract_deadline && next.abstract_deadline >= todayIso() && (
                <p
                  className={`mt-3 text-small ${
                    heroBackground ? "text-copper-400" : "text-copper-800"
                  }`}
                >
                  {t.events.abstractsOpen}
                  <span className="tabular">
                    {" · "}
                    {formatDate(next.abstract_deadline, locale)}
                  </span>
                </p>
              )}
            </div>

            {/*
              The count, in a gauge. A hairline separates it from the statement on a
              wide screen and sits above it on a phone, the way a register rules its
              columns.

              The ring reads against a declared scale — the final thirty days before
              the event — so the sweep states something a reader can hold: a quarter
              filled is three weeks out, nearly closed is this week. An arc set to an
              arbitrary offset would be ornament, and the whole point of a gauge is
              that its dial means the same thing every time you look at it. Beyond the
              window the track sits empty and the numeral still carries the count.

              The label sits under the ring rather than inside it: "ХОНОГ ҮЛДЛЭЭ" does
              not fit within a 96px circle, and the language that overflows is the one
              that sets the layout.
            */}
            {nextDays !== null && (
              <div
                className={`flex shrink-0 flex-col items-center border-t pt-5 md:border-t-0 md:border-l md:pt-0 md:pl-8 ${
                  heroBackground ? "border-white/15" : "border-copper-200"
                }`}
              >
                {nextDays > 0 ? (
                  <>
                    <div className="relative h-24 w-24">
                      <svg viewBox="0 0 96 96" className="h-24 w-24 -rotate-90" aria-hidden>
                        <circle
                          cx="48"
                          cy="48"
                          r={RING_RADIUS}
                          fill="none"
                          strokeWidth="4"
                          style={{
                            stroke: heroBackground
                              ? "rgb(255 255 255 / 0.15)"
                              : "var(--color-copper-200)",
                          }}
                        />
                        <circle
                          cx="48"
                          cy="48"
                          r={RING_RADIUS}
                          fill="none"
                          strokeWidth="4"
                          strokeLinecap="round"
                          style={{
                            stroke: heroBackground
                              ? "var(--color-copper-400)"
                              : "var(--color-copper-700)",
                            strokeDasharray: RING_CIRCUMFERENCE,
                            strokeDashoffset: RING_CIRCUMFERENCE * (1 - countdownFraction),
                          }}
                        />
                      </svg>
                      <span
                        className={`absolute inset-0 flex items-center justify-center tabular text-h3 font-bold ${
                          heroBackground ? "text-paper" : "text-ink-900"
                        }`}
                      >
                        {nextDays}
                      </span>
                    </div>
                    <span
                      className={`mt-2.5 text-[0.75rem] uppercase tracking-wide ${
                        heroBackground ? "text-ink-300" : "text-ink-600"
                      }`}
                    >
                      {t.events.daysToGo}
                    </span>
                  </>
                ) : (
                  <span
                    className={`text-[0.75rem] font-semibold uppercase tracking-wide ${
                      heroBackground ? "text-copper-400" : "text-copper-800"
                    }`}
                  >
                    {nextDays === 0 ? t.events.today : t.events.inProgress}
                  </span>
                )}
              </div>
            )}
          </Link>
        )}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* About                                                             */}
      {/* ---------------------------------------------------------------- */}
      {/*
        The introduction, with the Society's own photographs beside it.

        The paragraph makes claims — that MSID improves diagnosis, develops guidelines,
        trains specialists — and the photographs are the evidence sitting next to them,
        each captioned with the event it documents and linked to that event's page. This
        is where the hero's picture went: the same gallery component the event pages use,
        so the site turns pages through photographs one way rather than two.
      */}
      <section className="shell py-12 md:py-16">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
          <div>
            <h2 className="text-h2 font-semibold">{t.home.aboutTitle}</h2>
            <Prose body={tr(aboutPage, "body", locale)} className="mt-6" />
            <Link href={p("/about")} className="btn btn-ghost mt-6">
              {t.common.readMore} →
            </Link>
          </div>

          {galleryPhotos.length > 0 && (
            <EventGallery
              /* Fills its column. It was capped at 26rem when the text beside it was
                 five lines; after the measure widened, the cap left a strip of dead
                 space on the right and the smaller plate no longer balanced the column
                 of text (Chinguun, August 2026). */
              className="mt-2 w-full lg:mt-0"
              /* The frame matches the photographs. Six of the eight are 4:3 off a phone,
                 so a 4:3 frame lets them fill it exactly — a wider box letterboxed them
                 with 150px of dead space on either side. */
              frameClassName="aspect-4/3"
              photos={galleryPhotos}
              labels={{
                heading: t.events.gallery,
                show: t.events.show,
                enlarge: t.events.enlarge,
                close: t.events.close,
              }}
            />
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Congress & training                                               */}
      {/* ---------------------------------------------------------------- */}
      {/*
        A section with nothing to list is given less room than one with records in it.
        MSID has no congress scheduled yet, and holding a full section's height open for
        a three-line notice is what made this stretch of the page read as empty.
      */}
      <section className={`shell ${congressEmpty ? "py-10 md:py-12" : "py-12 md:py-16"}`}>
        <SectionHead
          title={t.home.congressTitle}
          lead={t.home.congressLead}
          action={
            upcoming.length > 0 ? (
              <Link href={p("/events")} className="btn btn-secondary">
                {t.common.viewAll}
              </Link>
            ) : undefined
          }
        />

        {/* The congress block keeps copper as its voice — a tint, not a drench. */}
        {featured && (
          <article className="mt-8 rounded-lg border border-ink-200 bg-paper p-6 md:p-9">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <p className="text-label font-semibold text-copper-700">
                {t.events.kind[featured.kind as keyof typeof t.events.kind]}
              </p>
              <p className="tabular text-small font-semibold text-ink-800">
                {formatDateRange(featured.starts_on, featured.ends_on, locale)}
              </p>
            </div>

            <h3 className="mt-3 max-w-[24ch] text-h2 font-semibold">
              {tr(featured, "title", locale)}
            </h3>

            {tr(featured, "summary", locale) && (
              <p className="mt-4 max-w-[62ch] text-ink-700">
                {tr(featured, "summary", locale)}
              </p>
            )}

            {(featured.abstract_deadline || featured.early_bird_deadline) && (
              <div className="table-scroll mt-7">
                <table className="data-table">
                  <caption>{t.events.deadlines}</caption>
                  <tbody>
                    {featured.abstract_deadline && (
                      <tr>
                        <th scope="row">{t.events.abstractDeadline}</th>
                        <td className="tabular">
                          {formatDateNumeric(featured.abstract_deadline)}
                        </td>
                      </tr>
                    )}
                    {featured.early_bird_deadline && (
                      <tr>
                        <th scope="row">{t.events.earlyBirdDeadline}</th>
                        <td className="tabular">
                          {formatDateNumeric(featured.early_bird_deadline)}
                        </td>
                      </tr>
                    )}
                    {featured.registration_closes_on && (
                      <tr>
                        <th scope="row">{t.events.registrationCloses}</th>
                        <td className="tabular">
                          {formatDateNumeric(featured.registration_closes_on)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={p(`/events/${featured.slug}`)}
                className="btn btn-primary"
              >
                {t.common.readMore}
              </Link>
              {featured.registration_open === 1 && (
                <Link
                  href={p(`/events/${featured.slug}/register`)}
                  className="btn btn-secondary"
                >
                  {t.events.register}
                </Link>
              )}
            </div>
          </article>
        )}

        {otherUpcoming.length > 0 ? (
          <div className="register mt-10">
            {otherUpcoming.map((event) => (
              <EventRow_ key={event.id} event={event} locale={locale} />
            ))}
          </div>
        ) : (
          !featured && (
            <div className="mt-6">
              <EmptyState
                title={t.events.noUpcoming}
                hint={t.events.noUpcomingHint}
                action={
                  <Link href={p("/membership")} className="btn btn-secondary">
                    {t.membership.apply}
                  </Link>
                }
              />
            </div>
          )
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* News                                                              */}
      {/* ---------------------------------------------------------------- */}
      {news.length > 0 && (
        <section className="border-t border-ink-200 py-12 md:py-16">
          <div className="shell">
            <SectionHead
              title={t.home.newsTitle}
              action={
                <Link href={p("/news")} className="btn btn-secondary">
                  {t.common.viewAll}
                </Link>
              }
            />
            <div className="register mt-8">
              {news.map((post) => (
                <NewsRow key={post.id} post={post} locale={locale} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Membership                                                        */}
      {/* ---------------------------------------------------------------- */}
      {/*
        Back on the landing page while the Society has little else to say here. The
        intended lifecycle is that news takes this slot over: once the administrator is
        publishing regularly, the section above carries the page and this one goes back
        to being reachable from the hero and the menu (Chinguun, August 2026).

        It returns in the page's own language rather than the copper-tinted band it left
        as. That band was a whole surface of colour for two sentences and a link, which
        is the thing the Restrained pass was undoing.

        That lifecycle is now the condition rather than a note: the moment the
        administrator publishes a first news post, the section above takes this slot and
        this one steps aside. Nobody has to remember to remove it.
      */}
      {news.length === 0 && (
      <section className="border-t border-ink-200 py-12 md:py-16">
        <div className="shell grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-16">
          <div>
            {/*
              The noun, not the action. In Mongolian `home.membershipTitle` is the very
              same string as `home.joinCta` — both "Гишүүнээр элсэх" — so using it here
              puts identical words in the heading and on the button below it. English
              keeps them distinct; Mongolian does not.
            */}
            <h2 className="text-h2 font-semibold">{t.eventsNav.membership}</h2>
            <p className="mt-5 max-w-[46ch] text-ink-700">{t.home.membershipLead}</p>
            <Link href={p("/membership")} className="btn btn-primary mt-7">
              {t.home.joinCta}
            </Link>
          </div>

          {tr(benefits, "body", locale) && (
            <div>
              <h3 className="text-label font-semibold text-ink-600">
                {t.membership.benefits}
              </h3>
              <ProseList body={tr(benefits, "body", locale)} />
            </div>
          )}
        </div>
      </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Partners                                                          */}
      {/* ---------------------------------------------------------------- */}
      {partners.length > 0 && (
        <section className="shell py-12 md:py-16">
          <h2 className="text-label font-semibold text-ink-600">
            {t.footer.partners}
          </h2>
          {/*
            The mark when the administrator has uploaded one, the acronym when they have
            not. A partner's logo is their identity and belongs here; a grey box standing
            in for a missing one is worse than the name set properly, so nothing is
            reserved for an image that may never arrive.

            Four partners sit in a still grid; from six they become a slow marquee — see
            PartnerMarquee for the reasoning and the reduced-motion fallback.
          */}
          <PartnerMarquee partners={partners} locale={locale} />
          <Link href={p("/collaboration")} className="btn btn-ghost mt-7">
            {t.nav.collaboration} →
          </Link>
        </section>
      )}
    </>
  );
}

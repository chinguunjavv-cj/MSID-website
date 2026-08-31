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
  formatDateNumeric,
  formatDateRange,
  daysUntil,
} from "@/lib/format";
import { EmptyState, Prose, ProseList, SectionHead } from "@/components/ui/Primitives";
import { EventRow_, NewsRow } from "@/components/site/records";
import { EventGallery } from "@/components/site/EventGallery";
import { PartnerMarquee } from "@/components/site/PartnerMarquee";

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
        (`settings-defaults.ts` has the licence note). The statement does not move, it
        gains a ground; the scrims below are the cost, and clearing the field in
        Тохиргоо is the way back.

        The name is not repeated here: it is in the masthead lockup, once.
      */}
      {/* overflow-hidden only with a photograph to clip: without one the markup is
          byte-for-byte what it was before this setting existed. */}
      <section
        className={`relative border-b border-ink-200 bg-ink-50${
          settings.hero_background ? " overflow-hidden" : ""
        }`}
      >
        {/*
          The optional photographic ground. Decorative by construction: the headline
          carries the meaning, so the stack is aria-hidden and the alt is empty rather
          than describing scenery nobody needs read aloud.

          Two scrim layers: a flat wash that guarantees the contrast floor wherever the
          text runs, and a left-weighted gradient. Every piece of hero content is
          left-aligned under a hard max-width (18ch headline, 56ch lead), so the wash
          only needs full strength on that side: under the text the layers stack to
          ~92% ink-50, the same floor as before, while the empty right half lets the
          photograph through at a bit over a third strength. On a phone the text spans
          the whole width, so the flat wash is stronger there and the gradient matters
          less. The event strip carries its own solid copper ground either way.
        */}
        {settings.hero_background && (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <Image
              src={settings.hero_background}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-ink-50/70 md:bg-ink-50/30" />
            <div className="absolute inset-0 bg-gradient-to-r from-ink-50/95 via-ink-50/80 via-50% to-ink-50/5" />
          </div>
        )}

        {/*
          The ruled ground, behind everything and inert to the pointer — only on the
          typographic hero. Hairlines over a photograph read as scan artefacts, and the
          photograph is already doing the job the rules did: giving the statement a ground.
        */}
        {!settings.hero_background && (
          <div aria-hidden className="ruled pointer-events-none absolute inset-0" />
        )}

        <div className="shell relative pt-12 pb-12 md:pt-20 md:pb-16">
          {/* The Society's colour, one hairline of it, the way a masthead rules a page. */}
          <span aria-hidden className="animate-settle block h-0.5 w-12 bg-copper-600" />

          <h1 className="animate-settle mt-7 max-w-[18ch] text-display font-bold text-balance text-ink-950">
            {heroTitle}
          </h1>

        {heroSub && (
          <p
            className="animate-settle mt-7 max-w-[56ch] text-lg leading-relaxed text-ink-700"
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
          <Link href={p("/guidelines")} className="btn btn-secondary">
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
        {next && (
          <Link
            href={p(`/events/${next.slug}`)}
            className="group mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-copper-200 bg-copper-50 px-5 py-3.5 text-small"
          >
            <span className="font-semibold text-copper-800">{t.events.upcoming}</span>
            <span aria-hidden className="text-copper-700">
              →
            </span>
            <span className="font-medium text-ink-900 group-hover:underline">
              {tr(next, "title", locale)}
            </span>
            <span className="tabular text-ink-600">
              {formatDateRange(next.starts_on, next.ends_on, locale)}
            </span>
            {tr(next, "city", locale) && (
              <span className="text-ink-600">· {tr(next, "city", locale)}</span>
            )}
            {nextDays !== null && nextDays > 0 && (
              <span className="tabular text-ink-600">
                · {nextDays} {t.events.daysUntil}
              </span>
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

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
  listPublishedGuidelines,
  listPublishedNews,
  listUpcomingEvents,
} from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { formatDate, formatDateNumeric, formatDateRange, daysUntil } from "@/lib/format";
import {
  EmptyState,
  Prose,
  ProseList,
  SectionHead,
} from "@/components/ui/Primitives";
import { EventRow_, GuidelineRow, NewsRow } from "@/components/site/records";
import { MsidMark } from "@/components/site/Mark";

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
  const [allGuidelines, upcoming, featured, news, partners, aboutPage, benefits] =
    await Promise.all([
      listPublishedGuidelines(),
      listUpcomingEvents(4),
      featuredEvent(),
      listPublishedNews(4),
      listPartners(),
      getPage("home.about"),
      getPage("membership.benefits"),
    ]);

  const guidelines = allGuidelines.slice(0, 6);

  const heroHeadline =
    (locale === "mn" ? settings.hero_headline_mn : settings.hero_headline_en) ||
    t.org.name;
  const heroLead =
    (locale === "mn" ? settings.hero_lead_mn : settings.hero_lead_en) || t.org.tagline;
  const heroAlt =
    (locale === "mn" ? settings.hero_image_alt_mn : settings.hero_image_alt_en) || "";

  const next = featured ?? upcoming[0];
  const nextDays = next ? daysUntil(next.starts_on) : null;

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* Hero — copper-drenched, with MSID's own mark as the art direction */}
      {/* ---------------------------------------------------------------- */}
      <section className="on-copper relative overflow-hidden">
        {settings.hero_image ? (
          <>
            <Image
              src={settings.hero_image}
              alt={heroAlt}
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            <div aria-hidden className="absolute inset-0 bg-ink-950/72" />
          </>
        ) : (
          /*
            No photograph uploaded yet: the society's own mark carries the panel.
            Held at low opacity so it reads as a watermark behind the type rather than
            as a picture competing with it — the headline still clears 4.5:1 over the
            darkest part of the mark.
          */
          <MsidMark
            priority
            className="pointer-events-none absolute -top-20 -right-28 w-[46rem] max-w-none md:-right-16 md:w-[58rem]"
            imageClassName="opacity-[0.17]"
          />
        )}

        <div className="shell relative py-16 md:py-24 lg:py-28">
          <h1 className="animate-settle max-w-[15ch] text-display font-extrabold text-paper">
            {heroHeadline}
          </h1>

          <p
            className="animate-settle mt-7 max-w-[46ch] text-lg leading-relaxed md:text-xl"
            style={{ animationDelay: "90ms" }}
          >
            {heroLead}
          </p>

          <div
            className="animate-settle mt-9 flex flex-wrap gap-3"
            style={{ animationDelay: "180ms" }}
          >
            <Link href={p("/membership")} className="btn btn-on-dark">
              {t.home.joinCta}
            </Link>
            <Link href={p("/guidelines")} className="btn btn-outline-light">
              {t.nav.guidelines}
            </Link>
          </div>
        </div>

        {/* What is next — a live fact, not a metric row */}
        <div className="relative border-t border-white/20">
          <div className="shell py-4">
            {next ? (
              <Link
                href={p(`/events/${next.slug}`)}
                className="group flex flex-wrap items-baseline gap-x-3 gap-y-1 text-small"
              >
                <span className="font-semibold text-paper">{t.events.upcoming}</span>
                <span aria-hidden className="text-paper/75">
                  →
                </span>
                <span className="font-medium text-paper group-hover:underline">
                  {tr(next, "title", locale)}
                </span>
                <span className="tabular text-paper/75">
                  {formatDateRange(next.starts_on, next.ends_on, locale)}
                </span>
                {tr(next, "city", locale) && (
                  <span className="text-paper/75">· {tr(next, "city", locale)}</span>
                )}
                {nextDays !== null && nextDays > 0 && (
                  <span className="tabular text-paper/75">
                    · {nextDays} {t.events.daysUntil}
                  </span>
                )}
              </Link>
            ) : (
              <p className="text-small text-paper/75">{t.events.noUpcoming}</p>
            )}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* About                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="shell py-16 md:py-20">
        <div className="grid gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:gap-16">
          <div>
            <h2 className="text-h2 font-bold">{t.home.aboutTitle}</h2>
            <Prose body={tr(aboutPage, "body", locale)} className="mt-6" />
            <Link href={p("/about")} className="btn btn-ghost mt-6">
              {t.common.readMore} →
            </Link>
          </div>

          <dl className="self-start border-t border-ink-200 pt-6 md:border-t-2 md:border-ink-900">
            <div className="border-b border-ink-200 py-3">
              <dt className="text-label font-semibold text-ink-600">{t.about.founded}</dt>
              <dd className="tabular mt-1 text-[1.0625rem] font-semibold text-ink-900">
                {formatDate(settings.founded_on, locale)}
              </dd>
            </div>
            <div className="border-b border-ink-200 py-3">
              <dt className="text-label font-semibold text-ink-600">
                {locale === "mn" ? "Хэлбэр" : "Type"}
              </dt>
              <dd className="mt-1 text-[1.0625rem] font-semibold text-ink-900">
                {t.footer.ngo}
              </dd>
            </div>
            <div className="border-b border-ink-200 py-3">
              <dt className="text-label font-semibold text-ink-600">
                {locale === "mn" ? "Байршил" : "Based in"}
              </dt>
              <dd className="mt-1 text-[1.0625rem] font-semibold text-ink-900">
                {locale === "mn" ? "Улаанбаатар" : "Ulaanbaatar"}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Guidelines register — the signature block                         */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-y border-ink-200 bg-ink-50 py-16 md:py-20">
        <div className="shell">
          <SectionHead
            title={t.home.guidelinesTitle}
            lead={t.home.guidelinesLead}
            action={
              guidelines.length > 0 ? (
                <Link href={p("/guidelines")} className="btn btn-secondary">
                  {t.common.viewAll}
                </Link>
              ) : undefined
            }
          />

          {guidelines.length > 0 ? (
            <div className="register mt-8">
              {guidelines.map((guideline) => (
                <GuidelineRow key={guideline.id} guideline={guideline} locale={locale} />
              ))}
            </div>
          ) : (
            <div className="mt-8">
              <EmptyState title={t.guidelines.empty} hint={t.guidelines.emptyHint} />
            </div>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Congress & training                                               */}
      {/* ---------------------------------------------------------------- */}
      <section className="shell py-16 md:py-20">
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

        {featured && (
          <article className="mt-8 border-2 border-ink-900 p-6 md:p-9">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <p className="text-label font-semibold text-copper-700">
                {t.events.kind[featured.kind as keyof typeof t.events.kind]}
              </p>
              <p className="tabular text-small font-semibold text-ink-800">
                {formatDateRange(featured.starts_on, featured.ends_on, locale)}
              </p>
            </div>

            <h3 className="mt-3 max-w-[24ch] text-h2 font-bold">
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
              <Link href={p(`/events/${featured.slug}`)} className="btn btn-primary">
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

        {upcoming.filter((event) => event.id !== featured?.id).length > 0 ? (
          <div className="register mt-10">
            {upcoming
              .filter((event) => event.id !== featured?.id)
              .map((event) => (
                <EventRow_ key={event.id} event={event} locale={locale} />
              ))}
          </div>
        ) : (
          !featured && (
            <div className="mt-8">
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
        <section className="border-t border-ink-200 py-16 md:py-20">
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
      <section className="border-y border-copper-200 bg-copper-50 py-16 md:py-20">
        <div className="shell grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-16">
          <div>
            <h2 className="text-h2 font-bold">{t.home.membershipTitle}</h2>
            <p className="mt-5 max-w-[46ch] text-ink-700">{t.home.membershipLead}</p>
            <Link href={p("/membership")} className="btn btn-primary mt-7">
              {t.home.joinCta}
            </Link>
          </div>

          {tr(benefits, "body", locale) && (
            <div>
              <h3 className="text-label font-semibold text-ink-700">
                {t.membership.benefits}
              </h3>
              <ProseList body={tr(benefits, "body", locale)} />
            </div>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Partners                                                          */}
      {/* ---------------------------------------------------------------- */}
      {partners.length > 0 && (
        <section className="shell py-14 md:py-16">
          <h2 className="text-label font-semibold text-ink-600">{t.footer.partners}</h2>
          <ul className="mt-6 flex flex-wrap gap-x-10 gap-y-5">
            {partners.map((partner) => (
              <li key={partner.id}>
                <a
                  href={partner.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group block"
                >
                  <span className="block text-xl font-bold tracking-tight text-ink-900 transition-colors duration-100 group-hover:text-copper-700">
                    {partner.acronym}
                  </span>
                  <span className="mt-0.5 block max-w-[30ch] text-[0.8125rem] text-ink-600">
                    {tr(partner, "name", locale)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <Link href={p("/collaboration")} className="btn btn-ghost mt-7">
            {t.nav.collaboration} →
          </Link>
        </section>
      )}
    </>
  );
}

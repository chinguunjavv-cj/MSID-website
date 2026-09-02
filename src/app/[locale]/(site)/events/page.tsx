import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { listPastEvents, listPublishedNews, listUpcomingEvents } from "@/lib/queries";
import { EmptyState, SectionHead } from "@/components/ui/Primitives";
import { SectionHeader } from "@/components/site/SectionHeader";
import { EventRow_, NewsRow } from "@/components/site/records";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).events.title };
}

export default async function EventsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const p = (path: string) => localePath(locale, path);

  const [upcoming, recentPast, news] = await Promise.all([
    listUpcomingEvents(),
    listPastEvents(5),
    listPublishedNews(5),
  ]);

  return (
    <>
      <SectionHeader
        title={t.events.title}
        lead={t.events.lead}
        meta={
          /* Stays `btn-secondary` on both grounds. With a banner set the header is a
             dark surface again, and `.on-dark .btn-secondary` in globals.css lifts the
             outline to paper there, so the one class is right either way. */
          <Link href={p("/membership")} className="btn btn-secondary">
            {t.home.joinCta}
          </Link>
        }
      />

      <div className="shell py-14 md:py-20">
        <section>
          <SectionHead title={t.events.upcoming} />
          {upcoming.length > 0 ? (
            <div className="register mt-6">
              {upcoming.map((event) => (
                <EventRow_ key={event.id} event={event} locale={locale} />
              ))}
            </div>
          ) : (
            <div className="mt-6">
              <EmptyState title={t.events.noUpcoming} hint={t.events.noUpcomingHint} />
            </div>
          )}
        </section>

        <section className="mt-16 md:mt-20">
          <SectionHead
            title={t.events.past}
            action={
              recentPast.length > 0 ? (
                <Link href={p("/events/past")} className="btn btn-secondary">
                  {t.common.viewAll}
                </Link>
              ) : undefined
            }
          />
          {recentPast.length > 0 ? (
            <div className="register mt-6">
              {recentPast.map((event) => (
                <EventRow_ key={event.id} event={event} locale={locale} />
              ))}
            </div>
          ) : (
            <div className="mt-6">
              <EmptyState title={t.events.noPast} />
            </div>
          )}
        </section>

        <section className="mt-16 md:mt-20">
          <SectionHead
            title={t.events.news}
            action={
              news.length > 0 ? (
                <Link href={p("/news")} className="btn btn-secondary">
                  {t.common.viewAll}
                </Link>
              ) : undefined
            }
          />
          {news.length > 0 ? (
            <div className="register mt-6">
              {news.map((post) => (
                <NewsRow key={post.id} post={post} locale={locale} />
              ))}
            </div>
          ) : (
            <div className="mt-6">
              <EmptyState title={t.events.noNews} />
            </div>
          )}
        </section>
      </div>
    </>
  );
}

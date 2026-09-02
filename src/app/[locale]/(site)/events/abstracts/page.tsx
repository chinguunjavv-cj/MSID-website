import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { tr } from "@/lib/db/types";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getPage, listOpenAbstractCalls } from "@/lib/queries";
import { formatDate, formatDateRange } from "@/lib/format";
import { EmptyState, PageHeader, Prose } from "@/components/ui/Primitives";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const page = await getPage("events.abstracts");
  return { title: tr(page, "title", locale) || getDictionary(locale).events.abstracts.title };
}

/**
 * Call for abstracts.
 *
 * Two parts. The prose is the `events.abstracts` page, edited from the admin like the
 * other fixed pages — the Society writes its own rules, format and address there when
 * it has them. Below it, every published event whose abstract deadline has not passed,
 * so a call opens on this page the moment an editor sets a deadline on the event and
 * closes by itself the day after — nothing here to keep in step by hand.
 */
export default async function AbstractsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const [page, calls] = await Promise.all([getPage("events.abstracts"), listOpenAbstractCalls()]);

  return (
    <>
      <PageHeader
        title={tr(page, "title", locale) || t.events.abstracts.title}
        lead={t.events.abstracts.lead}
        breadcrumb={[{ label: t.events.title, href: localePath(locale, "/events") }]}
      />

      <div className="shell py-14 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Prose body={tr(page, "body", locale)} />

          <aside>
            <h2 className="text-h3 font-bold">{t.events.abstracts.openCalls}</h2>
            {calls.length > 0 ? (
              <ul className="register mt-6">
                {calls.map((event) => (
                  <li key={event.id} className="register-row md:grid-cols-1">
                    <div className="min-w-0">
                      <p className="text-[0.8125rem] uppercase tracking-wide text-ink-600">
                        {t.events.kind[event.kind]}
                      </p>
                      <h3 className="mt-1 text-[1.0625rem] font-semibold text-ink-900">
                        <Link
                          href={localePath(locale, `/events/${event.slug}`)}
                          className="hover:text-copper-700"
                        >
                          {tr(event, "title", locale)}
                        </Link>
                      </h3>
                      <p className="mt-1 text-[0.8125rem] text-ink-600">
                        {formatDateRange(event.starts_on, event.ends_on, locale)}
                      </p>
                      <p className="mt-3 text-sm">
                        <span className="text-ink-600">{t.events.abstracts.deadline}: </span>
                        <strong className="tabular">{formatDate(event.abstract_deadline, locale)}</strong>
                      </p>
                      <p className="mt-3">
                        <Link
                          href={localePath(locale, `/events/${event.slug}`)}
                          className="btn btn-secondary text-[0.8125rem]"
                        >
                          {t.events.abstracts.viewEvent}
                        </Link>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-6">
                <EmptyState title={t.events.abstracts.noOpenCalls} />
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}

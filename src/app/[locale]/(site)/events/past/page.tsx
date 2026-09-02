import type { Metadata } from "next";
import { tr } from "@/lib/db/types";
import { notFound } from "next/navigation";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { countPastEvents, getPage, listPastEvents } from "@/lib/queries";
import { EmptyState, Pagination } from "@/components/ui/Primitives";
import { SectionHeader } from "@/components/site/SectionHeader";
import { EventRow_ } from "@/components/site/records";

const PER_PAGE = 20;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).events.past };
}

export default async function PastEventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const { page: pageParam } = await searchParams;
  const total = await countPastEvents();
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(Math.max(1, Number(pageParam) || 1), totalPages);

  const t = getDictionary(locale);
  /* `page` is already the pagination number here, so the row keeps its own name. */
  const pageRow = await getPage("events.past");
  const events = await listPastEvents(PER_PAGE, (page - 1) * PER_PAGE);

  return (
    <>
      <SectionHeader
        banner={pageRow?.banner}
        title={tr(pageRow, "title", locale) || t.events.past}
        breadcrumb={[{ label: t.events.title, href: localePath(locale, "/events") }]}
      />

      <div className="shell py-14 md:py-20">
        {events.length > 0 ? (
          <>
            <div className="register">
              {events.map((event) => (
                <EventRow_ key={event.id} event={event} locale={locale} />
              ))}
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              hrefFor={(next) => `${localePath(locale, "/events/past")}?page=${next}`}
              labels={{
                previous: t.common.back,
                next: t.common.continue,
                page: t.common.page,
                of: t.common.of,
              }}
            />
          </>
        ) : (
          <EmptyState title={t.events.noPast} />
        )}
      </div>
    </>
  );
}

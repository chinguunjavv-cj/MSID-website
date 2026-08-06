import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tr } from "@/lib/db/types";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getPage, listHistoryEntries } from "@/lib/queries";
import { formatDate, formatDayMonth, parseDate } from "@/lib/format";
import { EmptyState, PageHeader, Prose } from "@/components/ui/Primitives";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).aboutNav.history };
}

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const page = await getPage("about.history");
  const entries = await listHistoryEntries();

  return (
    <>
      <PageHeader
        title={tr(page, "title", locale) || t.aboutNav.history}
        lead={tr(page, "body", locale) || undefined}
      />

      <div className="shell py-14 md:py-20">
        {entries.length > 0 ? (
          /*
            A timeline, not a decorated one: year in the left column, event in the
            right, hairline between. The society is two years old — an ornate vertical
            timeline with connector dots would be pretending there is more here.
          */
          <ol className="register">
            {entries.map((entry) => (
              <li key={entry.id} className="register-row">
                <div>
                  <p className="tabular text-h3 font-bold text-copper-700">
                    {entry.year}
                  </p>
                  {/*
                    The year already has a column of its own, so the date beneath it drops
                    the year rather than printing "2024" twice within one row. It is only
                    kept in full on the rare entry whose exact date falls in a different
                    year from the one it is filed under.
                  */}
                  {entry.happened_on && (
                    <time
                      dateTime={entry.happened_on}
                      className="tabular mt-1 block text-[0.8125rem] text-ink-600"
                    >
                      {parseDate(entry.happened_on)?.getFullYear() === entry.year
                        ? formatDayMonth(entry.happened_on, locale)
                        : formatDate(entry.happened_on, locale)}
                    </time>
                  )}
                </div>

                <div className="min-w-0 md:col-span-2">
                  <h2 className="text-[1.0625rem] font-semibold text-ink-900">
                    {tr(entry, "title", locale)}
                  </h2>
                  {tr(entry, "body", locale) && (
                    <p className="mt-2 max-w-[62ch] text-ink-700">
                      {tr(entry, "body", locale)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title={t.about.historyEmpty} />
        )}
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { tr } from "@/lib/db/types";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getPage, listOpenAbstractCalls } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { daysUntil, formatDate, formatDateRange } from "@/lib/format";
import { EmptyState, Prose } from "@/components/ui/Primitives";
import { SectionHeader } from "@/components/site/SectionHeader";

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
 * One fact, labelled, in the register's voice: a small caps label over the value.
 * Used along the strip under the header and inside the call panel, so a deadline
 * reads the same on both.
 */
function Fact({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[0.75rem] uppercase tracking-wide text-ink-600">{label}</div>
      <div className="mt-1 font-semibold text-ink-900">{children}</div>
    </div>
  );
}

/**
 * Call for abstracts.
 *
 * Two parts. The prose is the `events.abstracts` page, edited from the admin like the
 * other fixed pages — the Society writes its own rules, format and address there when
 * it has them. Beside it, every published event whose abstract deadline has not passed,
 * so a call opens on this page the moment an editor sets a deadline on the event and
 * closes by itself the day after — nothing here to keep in step by hand.
 *
 * The open call is stated twice on purpose. A strip under the header carries the three
 * facts a reader came for — when submissions close, when the meeting is, where — before
 * any rule is read; the panel beside the rules then holds the same call with its actions,
 * in view while the rules are being read. A visitor who only wants the date never has to
 * enter the prose at all.
 */
export default async function AbstractsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const [page, calls, settings] = await Promise.all([
    getPage("events.abstracts"),
    listOpenAbstractCalls(),
    getSettings(),
  ]);

  /* The nearest deadline leads; anything else open is listed under it. */
  const lead = calls[0];
  const rest = calls.slice(1);
  const leadDays = lead ? daysUntil(lead.abstract_deadline) : null;
  const place = lead
    ? [tr(lead, "venue", locale), tr(lead, "city", locale)].filter(Boolean).join(", ")
    : "";

  return (
    <>
      <SectionHeader
        banner={page?.banner}
        title={tr(page, "title", locale) || t.events.abstracts.title}
        lead={t.events.abstracts.lead}
        breadcrumb={[{ label: t.events.title, href: localePath(locale, "/events") }]}
      />

      {/*
        The facts strip. Ruled top and bottom on the same hairline as every register on
        the site, so it reads as the record's masthead rather than as a banner bolted
        under the header.
      */}
      {lead && (
        <div className="shell">
          <div className="grid gap-6 border-b border-ink-200 py-6 sm:grid-cols-3 md:py-7">
            <Fact label={t.events.abstracts.deadline}>
              <span className="tabular">{formatDate(lead.abstract_deadline, locale)}</span>
              {leadDays !== null && leadDays > 0 && (
                <span className="ml-2 font-normal text-copper-700">
                  <span className="tabular">{leadDays}</span> {t.events.daysToGo}
                </span>
              )}
            </Fact>
            <Fact label={t.events.abstracts.meetingDates}>
              <span className="tabular">
                {formatDateRange(lead.starts_on, lead.ends_on, locale)}
              </span>
            </Fact>
            {place && <Fact label={t.common.venue}>{place}</Fact>}
          </div>
        </div>
      )}

      <div className="shell py-14 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-16">
          <Prose body={tr(page, "body", locale)} />

          {/*
            On a phone the single column puts the rules first and the open call two
            thousand characters below them, so the one thing a reader came to check —
            whether anything is open, and until when — is the last thing they reach.
            An open call moves to the top there; from `lg` up it sits beside the rules
            and sticks, so the deadline stays in view for the length of the reading.
            When nothing is open the order stands as written: an empty panel is a poor
            way to open a page, and the prose then explains what will appear.
          */}
          <aside className={lead ? "order-first lg:order-none" : undefined}>
            <div className="lg:sticky lg:top-24">
              <h2 className="text-h3 font-bold">{t.events.abstracts.openCalls}</h2>

              {lead ? (
                <>
                  <div className="mt-5 border border-ink-200">
                    <div className="border-b border-ink-200 px-5 py-4">
                      <p className="text-[0.75rem] uppercase tracking-wide text-copper-700">
                        {t.events.kind[lead.kind]}
                      </p>
                      <h3 className="mt-1.5 text-[1.0625rem] font-semibold leading-snug text-ink-900">
                        <Link
                          href={localePath(locale, `/events/${lead.slug}`)}
                          className="transition-colors duration-100 hover:text-copper-700"
                        >
                          {tr(lead, "title", locale)}
                        </Link>
                      </h3>
                    </div>

                    {/*
                      The deadline is the reason this panel exists, so it gets the one
                      tinted ground on the page and the largest numeral. Copper at the
                      50 step: enough to separate it from paper without turning a date
                      into an alarm.

                      Only from `lg`, where the panel sits beside the rules and sticks:
                      there the strip scrolls away and this is what keeps the closing
                      date in view for the length of the reading. Below `lg` the panel
                      sits directly under the strip, close enough to read as one block,
                      and repeating the date two inches below itself is not emphasis.
                    */}
                    <div className="hidden border-b border-ink-200 bg-copper-50 px-5 py-5 lg:block">
                      <div className="text-[0.75rem] uppercase tracking-wide text-copper-800">
                        {t.events.abstracts.deadline}
                      </div>
                      <div className="tabular mt-1 text-h3 font-bold text-ink-950">
                        {formatDate(lead.abstract_deadline, locale)}
                      </div>
                      {leadDays !== null && leadDays > 0 && (
                        <div className="mt-1 text-small text-copper-800">
                          <span className="tabular font-semibold">{leadDays}</span>{" "}
                          {t.events.daysToGo}
                        </div>
                      )}
                    </div>

                    {/*
                      No dates or venue repeated here. The strip above states them once;
                      what this panel owes a reader halfway down the rules is the date
                      submissions close and the way through to the meeting, and a panel
                      that restates the strip verbatim two inches below it reads as a
                      layout that lost track of what it had already said.
                    */}
                    <div className="px-5 py-5">
                      <Link
                        href={localePath(locale, `/events/${lead.slug}`)}
                        className="btn btn-primary w-full justify-center"
                      >
                        {t.events.abstracts.viewEvent}
                      </Link>
                      {settings.contact_email && (
                        <p className="mt-4 text-[0.8125rem] text-ink-600">
                          {t.events.abstracts.enquiries}
                          <br />
                          <a
                            href={`mailto:${settings.contact_email}`}
                            className="font-medium text-ink-900 transition-colors duration-100 hover:text-copper-700"
                          >
                            {settings.contact_email}
                          </a>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Anything else open, as plain rows: the same record, less of it. */}
                  {rest.length > 0 && (
                    <div className="mt-8">
                      <h3 className="text-[0.75rem] uppercase tracking-wide text-ink-600">
                        {t.events.abstracts.alsoOpen}
                      </h3>
                      <ul className="register mt-2">
                        {rest.map((event) => (
                          <li key={event.id} className="register-row md:grid-cols-1">
                            <div className="min-w-0">
                              <Link
                                href={localePath(locale, `/events/${event.slug}`)}
                                className="text-small font-semibold text-ink-900 transition-colors duration-100 hover:text-copper-700"
                              >
                                {tr(event, "title", locale)}
                              </Link>
                              <p className="mt-1 text-[0.8125rem] text-ink-600">
                                {t.events.abstracts.deadline}:{" "}
                                <span className="tabular font-medium text-ink-900">
                                  {formatDate(event.abstract_deadline, locale)}
                                </span>
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-6">
                  <EmptyState title={t.events.abstracts.noOpenCalls} />
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasTranslation, tr } from "@/lib/db/types";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  countEventRegistrations,
  getEventBySlug,
  listEventFees,
  listEventSessions,
  registrationState,
} from "@/lib/queries";
import {
  daysUntil,
  formatDate,
  formatDateNumeric,
  formatDateRange,
  formatMnt,
} from "@/lib/format";
import {
  PageHeader,
  Prose,
  StatusPill,
  TranslationNotice,
} from "@/components/ui/Primitives";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const event = getEventBySlug(slug);
  if (!event) return {};
  return {
    title: tr(event, "title", locale),
    description: tr(event, "summary", locale) || undefined,
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const event = getEventBySlug(slug);
  if (!event) notFound();

  const t = getDictionary(locale);
  const fees = listEventFees(event.id);
  const sessions = listEventSessions(event.id);
  const state = registrationState(event);
  const taken = countEventRegistrations(event.id);
  const remaining = event.capacity ? Math.max(0, event.capacity - taken) : null;
  const countdown = daysUntil(event.starts_on);

  const stateLabel = {
    open: t.events.registrationOpen,
    not_yet: t.events.registrationNotOpen,
    closed: t.events.registrationClosed,
    disabled: t.events.registrationClosed,
  }[state];

  const deadlines = [
    { label: t.events.abstractDeadline, value: event.abstract_deadline },
    { label: t.events.earlyBirdDeadline, value: event.early_bird_deadline },
    { label: t.events.registrationOpens, value: event.registration_opens_on },
    { label: t.events.registrationCloses, value: event.registration_closes_on },
  ].filter((row) => row.value);

  // Programme rows grouped by day, preserving the admin's ordering within each day.
  const days = [...new Set(sessions.map((session) => session.day ?? ""))];

  return (
    <>
      <PageHeader
        title={tr(event, "title", locale)}
        lead={tr(event, "summary", locale) || undefined}
        breadcrumb={[{ label: t.events.title, href: localePath(locale, "/events") }]}
        meta={
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <StatusPill
              label={stateLabel}
              tone={state === "open" ? "active" : state === "not_yet" ? "pending" : "neutral"}
            />
            <p className="tabular text-small text-ink-200">
              {formatDateRange(event.starts_on, event.ends_on, locale)}
            </p>
            {tr(event, "venue", locale) && (
              <p className="text-small text-ink-300">
                {[tr(event, "venue", locale), tr(event, "city", locale)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {countdown !== null && countdown > 0 && (
              <p className="tabular text-small text-ink-300">
                {countdown} {t.events.daysUntil}
              </p>
            )}
          </div>
        }
      />

      {event.cover_image && (
        <div className="shell -mt-px pt-10">
          <Image
            src={event.cover_image}
            alt={tr(event, "cover_alt", locale)}
            width={1600}
            height={900}
            className="aspect-video w-full object-cover"
            priority
          />
        </div>
      )}

      <div className="shell py-14 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
          <div>
            {!hasTranslation(event, "body", locale) && tr(event, "body", locale) && (
              <TranslationNotice locale={locale} />
            )}

            <Prose body={tr(event, "body", locale)} />

            {sessions.length > 0 && (
              <section className="mt-14">
                <h2 className="text-h3 font-bold">{t.events.programme}</h2>
                {days.map((day) => {
                  const rows = sessions.filter((session) => (session.day ?? "") === day);
                  return (
                    <div key={day || "unscheduled"} className="mt-8">
                      {day && (
                        <h3 className="tabular text-label font-semibold text-copper-700">
                          {formatDate(day, locale)}
                        </h3>
                      )}
                      <div className="table-scroll mt-3">
                        <table className="data-table">
                          <caption className="sr-only">
                            {t.events.programme}
                            {day ? ` — ${formatDate(day, locale)}` : ""}
                          </caption>
                          <thead>
                            <tr>
                              <th scope="col" className="w-32">
                                {locale === "mn" ? "Цаг" : "Time"}
                              </th>
                              <th scope="col">{t.common.title}</th>
                              <th scope="col">
                                {locale === "mn" ? "Илтгэгч" : "Speaker"}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((session) => (
                              <tr key={session.id}>
                                <td className="tabular whitespace-nowrap">
                                  {[session.starts_at, session.ends_at]
                                    .filter(Boolean)
                                    .join("–")}
                                </td>
                                <td>
                                  <span className="font-medium text-ink-900">
                                    {tr(session, "title", locale)}
                                  </span>
                                  {tr(session, "room", locale) && (
                                    <span className="mt-0.5 block text-[0.8125rem] text-ink-600">
                                      {tr(session, "room", locale)}
                                    </span>
                                  )}
                                </td>
                                <td>{tr(session, "speaker", locale)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </section>
            )}
          </div>

          <aside className="lg:sticky lg:top-32 lg:self-start">
            {state === "open" ? (
              <Link
                href={localePath(locale, `/events/${event.slug}/register`)}
                className="btn btn-primary w-full"
              >
                {t.events.register}
              </Link>
            ) : (
              <p className="border border-ink-200 bg-ink-50 px-4 py-3 text-center text-small text-ink-700">
                {stateLabel}
              </p>
            )}

            {event.external_url && (
              <a
                href={event.external_url}
                target="_blank"
                rel="noreferrer noopener"
                className="btn btn-secondary mt-3 w-full"
              >
                {locale === "mn" ? "Албан ёсны хуудас" : "Official site"} ↗
              </a>
            )}

            {remaining !== null && (
              <p className="tabular mt-4 text-center text-small text-ink-600">
                {remaining} {t.events.seatsLeft}
              </p>
            )}

            {deadlines.length > 0 && (
              <div className="mt-8">
                <h2 className="text-label font-semibold text-ink-600">
                  {t.events.deadlines}
                </h2>
                <dl className="mt-3 border-t-2 border-ink-900">
                  {deadlines.map((row) => (
                    <div key={row.label} className="border-b border-ink-200 py-3">
                      <dt className="text-[0.8125rem] text-ink-600">{row.label}</dt>
                      <dd className="tabular mt-0.5 font-semibold text-ink-900">
                        {formatDateNumeric(row.value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {fees.length > 0 && (
              <div className="mt-8">
                <h2 className="text-label font-semibold text-ink-600">{t.events.fees}</h2>
                <dl className="mt-3 border-t-2 border-ink-900">
                  {fees.map((fee) => (
                    <div key={fee.id} className="border-b border-ink-200 py-3">
                      <dt className="text-[0.8125rem] text-ink-600">
                        {tr(fee, "label", locale)}
                      </dt>
                      <dd className="tabular mt-0.5 font-semibold text-ink-900">
                        {formatMnt(fee.amount_mnt, locale)}
                        {fee.early_amount_mnt != null &&
                          fee.early_amount_mnt !== fee.amount_mnt && (
                            <span className="ml-2 font-normal text-ink-600">
                              ({formatMnt(fee.early_amount_mnt, locale)})
                            </span>
                          )}
                      </dd>
                    </div>
                  ))}
                </dl>
                {fees.some(
                  (fee) =>
                    fee.early_amount_mnt != null &&
                    fee.early_amount_mnt !== fee.amount_mnt,
                ) && (
                  <p className="mt-2 text-[0.8125rem] text-ink-600">
                    ( ) = {t.events.earlyBirdDeadline}
                  </p>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}

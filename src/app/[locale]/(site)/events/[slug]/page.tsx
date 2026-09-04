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
  listEventPhotos,
  listEventOrganisers,
  listEventSessions,
  registrationState,
} from "@/lib/queries";
import { EventGallery } from "@/components/site/EventGallery";
import {
  daysUntil,
  formatDate,
  formatDateNumeric,
  formatDateRange,
  formatMnt,
  todayIso,
} from "@/lib/format";
import {
  EmptyState,
  PageHeader,
  StaffPreviewNotice,
  Prose,
  StatusPill,
  TranslationNotice,
} from "@/components/ui/Primitives";
import { VideoEmbed } from "@/components/site/VideoEmbed";
import { safeExternalLink } from "@/lib/video";
import {
  AnnouncementBand,
  CallForAbstractsCard,
  OrganiserList,
  announcementFacts,
  callForAbstracts,
} from "@/components/site/EventAnnouncement";
import { currentUser, isStaff } from "@/lib/auth/session";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const event = await getEventBySlug(slug);
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

  /*
    Staff see unpublished records here so "View on site" in the admin is a real
    preview. Everyone else gets the published-only query, and a draft 404s.
  */
  const staff = isStaff(await currentUser());
  const event = await getEventBySlug(slug, staff);
  if (!event) notFound();

  const t = getDictionary(locale);
  // Independent of each other; one round trip's worth of latency, not three.
  const [fees, sessions, taken, photos, organisers] = await Promise.all([
    listEventFees(event.id),
    listEventSessions(event.id),
    countEventRegistrations(event.id),
    listEventPhotos(event.id),
    listEventOrganisers(event.id),
  ]);
  const state = registrationState(event);
  const remaining = event.capacity ? Math.max(0, event.capacity - taken) : null;
  const countdown = daysUntil(event.starts_on);

  /*
    `disabled` means online registration is switched off, which reads two different ways
    depending on when the event is. The Society announces a course weeks before it settles
    a fee and opens a form — the September training was published with its call for
    abstracts and nothing else — and telling a reader registration has *closed* turns them
    away from something they can still attend. Ahead of the event it is "not open yet";
    once it is over, "closed" is the truth.
  */
  const eventEnd = event.ends_on ?? event.starts_on;
  const finished = eventEnd !== null && eventEnd < todayIso();

  const stateLabel = {
    open: t.events.registrationOpen,
    not_yet: t.events.registrationNotOpen,
    closed: t.events.registrationClosed,
    disabled: finished ? t.events.registrationClosed : t.events.registrationNotOpen,
  }[state];

  const deadlines = [
    { label: t.events.abstractDeadline, value: event.abstract_deadline },
    { label: t.events.earlyBirdDeadline, value: event.early_bird_deadline },
    { label: t.events.registrationOpens, value: event.registration_opens_on },
    { label: t.events.registrationCloses, value: event.registration_closes_on },
  ].filter((row) => row.value);

  // Programme rows grouped by day, preserving the admin's ordering within each day.
  const days = [...new Set(sessions.map((session) => session.day ?? ""))];

  /*
    Whether the main column has anything to say. A freshly created event often has only
    a summary and a registration switch — no body, no photographs, no programme. The
    two-column grid still reserved the main column, which put a void where the record
    should be and marooned the registration button in a sidebar beside nothing.
  */
  const hasMain = Boolean(
    tr(event, "body", locale) || photos.length > 0 || event.video_url || sessions.length > 0,
  );

  /*
    An event that has already happened is a record, not an offer.

    The sidebar used to announce "Бүртгэл хаагдсан" on a congress from 2024, which tells
    a reader nothing they could not work out from the date at the top of the page, and
    put a dead control where the page should simply be about what happened (Chinguun,
    August 2026). Past events therefore drop the registration state, the seats-left
    count and the deadline table; what remains is the date, the venue, and the record —
    the programme, the photographs, the recording.
  */
  const isPast = (event.ends_on ?? event.starts_on ?? "") < todayIso();

  const place = [tr(event, "venue", locale), tr(event, "city", locale)]
    .filter(Boolean)
    .join(", ");

  /* The band and the organisers share one wrapper below; whether it renders at all. */
  const hasAnnouncement = announcementFacts(event, locale).length > 0 || organisers.length > 0;

  const { callOpen } = callForAbstracts(event);
  /* The card already carries the abstract deadline; the list beneath keeps the rest. */
  const otherDeadlines = callOpen
    ? deadlines.filter((row) => row.label !== t.events.abstractDeadline)
    : deadlines;

  const registrationPanel = (
    <>
      <CallForAbstractsCard event={event} locale={locale} />
      <div className={callOpen ? "mt-8" : undefined}>
      {state === "open" ? (
        <Link
          href={localePath(locale, `/events/${event.slug}/register`)}
          className="btn btn-primary w-full"
        >
          {t.events.register}
        </Link>
      ) : (
        !isPast && (
          <p className="border border-ink-200 bg-ink-50 px-4 py-3 text-center text-small text-ink-700">
            {stateLabel}
          </p>
        )
      )}

      {event.external_url && (
        <a
          href={safeExternalLink(event.external_url) ?? "#"}
          target="_blank"
          rel="noreferrer noopener"
          className="btn btn-secondary mt-3 w-full"
        >
          {locale === "mn" ? "Албан ёсны хуудас" : "Official site"} ↗
        </a>
      )}

      {remaining !== null && !isPast && (
        <p className="tabular mt-4 text-center text-small text-ink-600">
          {remaining} {t.events.seatsLeft}
        </p>
      )}

      {otherDeadlines.length > 0 && !isPast && (
        <div className="mt-8">
          <h2 className="text-label font-semibold text-ink-600">
            {t.events.deadlines}
          </h2>
          <dl className="mt-3 border-t-2 border-ink-900">
            {otherDeadlines.map((row) => (
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
      </div>
    </>
  );

  return (
    <>
      {event.status !== "published" && (
        <StaffPreviewNotice locale={locale} status={event.status} />
      )}

      <PageHeader
        title={tr(event, "title", locale)}
        lead={tr(event, "summary", locale) || undefined}
        breadcrumb={[{ label: t.events.title, href: localePath(locale, "/events") }]}
        eyebrow={t.events.kind[event.kind]}
        aside={
          /* The two facts a reader wants before the title: when, and where. */
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5 shrink-0 text-copper-700"
                aria-hidden
              >
                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <strong className="tabular font-semibold text-ink-900">
                {formatDateRange(event.starts_on, event.ends_on, locale)}
              </strong>
            </span>
            {place && (
              <>
                <span aria-hidden className="text-ink-300">
                  |
                </span>
                <span>{place}</span>
              </>
            )}
          </div>
        }
        meta={
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            {/* Registration status is news only while registering is possible. On a
                congress from 2024 the pill said "closed" next to a 2024 date. */}
            {!isPast && (
              <StatusPill
                label={stateLabel}
                tone={state === "open" ? "active" : state === "not_yet" ? "pending" : "neutral"}
              />
            )}
            {countdown !== null && countdown > 0 && (
              <p className="tabular text-small text-ink-600">
                {countdown} {t.events.daysUntil}
              </p>
            )}
          </div>
        }
      />

      {/*
        Shown whole, at its own aspect ratio, rather than cropped to a 16:9 band. These
        are group photographs taken at banners — the crop that makes a tidy header band
        is the crop that takes the delegates' heads off. Capped in width so a 4:3 frame
        does not occupy the entire screen before a word of the record is read.
      */}
      {event.cover_image && (
        <div className="shell -mt-px pt-10">
          <Image
            src={event.cover_image}
            alt={tr(event, "cover_alt", locale)}
            width={1600}
            height={1200}
            className="h-auto w-full max-w-5xl"
            priority
          />
        </div>
      )}

      {/*
        The announcement band: what the meeting is, before what happens at it.

        A congress announcement in this field opens by establishing two things — how it
        is taught and accredited, and whose authority is behind it. Both were absent:
        the format lived nowhere, and four co-organising institutions were a clause
        inside a summary paragraph. The pieces are shared with the home page block so
        the meeting is stated the same way wherever it is announced.
      */}
      {hasAnnouncement && (
        <div className="shell pt-10">
          <AnnouncementBand event={event} locale={locale} />
          <OrganiserList
            organisers={organisers}
            locale={locale}
            className={
              announcementFacts(event, locale).length > 0 ? "mt-8" : "border-t border-ink-200 pt-8"
            }
          />
        </div>
      )}

      <div className="shell py-14 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
          {/*
            A record with no details yet says so, in the visitor's language, rather than
            leaving a void beside the registration button. An event that is only a date
            and a capacity is "not yet written", never "broken".
          */}
          {!hasMain ? (
            <EmptyState title={t.events.noDetails} />
          ) : (
          <div>
            {!hasTranslation(event, "body", locale) && tr(event, "body", locale) && (
              <TranslationNotice locale={locale} />
            )}

            <Prose body={tr(event, "body", locale)} />

            <EventGallery
              photos={photos.map((photo) => ({
                id: photo.id,
                image: photo.image,
                alt: tr(photo, "alt", locale) || tr(event, "title", locale),
                caption: tr(photo, "caption", locale),
              }))}
              labels={{
                heading: t.events.gallery,
                show: t.events.show,
                enlarge: t.events.enlarge,
                close: t.events.close,
              }}
            />

            {event.video_url && (
              <VideoEmbed
                url={event.video_url}
                locale={locale}
                label={locale === "mn" ? "Арга хэмжээний бичлэг" : "Event recording"}
              />
            )}

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
          )}

          <aside className="lg:sticky lg:top-32 lg:self-start">
            {registrationPanel}
          </aside>
        </div>
      </div>

      {/*
        The strip a printed announcement closes on: who accredits the meeting, and once
        more when and where it is. Only when there is an accreditation to state — a
        strip that repeated the dates alone would be the header again at the bottom.
      */}
      {tr(event, "accreditation", locale) && (
        <div className="shell">
          <div className="flex flex-col gap-3 border-t border-ink-200 py-6 text-[0.8125rem] text-ink-600 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
            <p className="max-w-[70ch]">{tr(event, "accreditation", locale)}</p>
            <p className="shrink-0 tabular">
              {t.events.abstracts.meetingDates}: {formatDateRange(event.starts_on, event.ends_on, locale)}
              {tr(event, "city", locale) && (
                <>
                  <span aria-hidden className="mx-2 text-ink-400">•</span>
                  {tr(event, "city", locale)}
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

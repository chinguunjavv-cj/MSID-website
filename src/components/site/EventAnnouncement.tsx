import Link from "next/link";
import { tr, type EventOrganiser, type EventRow, type Locale } from "@/lib/db/types";
import { localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatDate, todayIso } from "@/lib/format";
import { safeFileHref } from "@/lib/video";
import { StatusPill } from "@/components/ui/Primitives";

/**
 * The pieces of a congress announcement, shared by the home page block and the event
 * page so the Society's meeting is stated the same way wherever it is announced.
 *
 * Three parts, each optional and each hiding itself until an editor fills it in:
 * the band of what the meeting is (format, accreditation, language), the institutions
 * holding it, and the call for abstracts as a card of its own. Heading levels are a
 * prop because the same card sits under an h1 on the event page and under an h3 on the
 * home page, and a heading outline that skips a level is a real defect for a screen
 * reader even when nothing looks wrong.
 */

type HeadingTag = "h2" | "h3" | "h4";

const below: Record<HeadingTag, "h3" | "h4" | "h5"> = { h2: "h3", h3: "h4", h4: "h5" };

/* ------------------------------------------------------------------------- */
/* The band: what the meeting states about itself                             */
/* ------------------------------------------------------------------------- */

export function announcementFacts(event: EventRow, locale: Locale) {
  const t = getDictionary(locale);
  return [
    { label: t.events.format, value: tr(event, "format", locale) },
    { label: t.events.accreditation, value: tr(event, "accreditation", locale) },
    { label: t.events.languages, value: tr(event, "languages", locale) },
  ].filter((fact) => fact.value);
}

/**
 * Set against hairlines rather than in cards, so the band reads as the record's
 * masthead and not as a row of tiles.
 */
export function AnnouncementBand({
  event,
  locale,
  className = "",
}: {
  event: EventRow;
  locale: Locale;
  className?: string;
}) {
  const facts = announcementFacts(event, locale);
  if (facts.length === 0) return null;

  return (
    <dl className={`grid gap-6 border-y border-ink-200 py-6 sm:grid-cols-3 ${className}`}>
      {facts.map((fact) => (
        <div key={fact.label}>
          <dt className="text-[0.75rem] uppercase tracking-wide text-ink-600">{fact.label}</dt>
          <dd className="mt-1 font-semibold text-ink-900">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------------- */
/* Who is holding the meeting                                                 */
/* ------------------------------------------------------------------------- */

export function OrganiserList({
  organisers,
  locale,
  as = "h2",
  className = "",
}: {
  organisers: EventOrganiser[];
  locale: Locale;
  as?: HeadingTag;
  className?: string;
}) {
  if (organisers.length === 0) return null;
  const t = getDictionary(locale);
  const Heading = as;

  return (
    <div className={className}>
      <Heading className="text-[0.75rem] uppercase tracking-wide text-ink-600">
        {t.events.organisers}
      </Heading>
      <ul className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {organisers.map((organiser) => (
          <li key={organiser.id} className="border-l border-ink-300 pl-4">
            <p className="font-semibold text-ink-900">{tr(organiser, "name", locale)}</p>
            {tr(organiser, "role", locale) && (
              <p className="text-small text-ink-600">{tr(organiser, "role", locale)}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* The call for abstracts                                                     */
/* ------------------------------------------------------------------------- */

/**
 * The card exists while the meeting is ahead and a deadline is set. Once the deadline
 * has passed the card stays, marked closed, so a reader who arrives late learns that
 * from the card rather than from the absence of one; once the meeting itself is over
 * the card goes with the rest of the offer.
 */
export function callForAbstracts(event: EventRow): { callOpen: boolean; abstractsOpen: boolean } {
  const today = todayIso();
  const isPast = (event.ends_on ?? event.starts_on ?? "") < today;
  const callOpen = Boolean(event.abstract_deadline) && !isPast;
  const abstractsOpen = callOpen && (event.abstract_deadline as string) >= today;
  return { callOpen, abstractsOpen };
}

/**
 * "Oral presentations: clinical trials, novel therapies" — split once on the first
 * colon so the kind of submission can be set in bold against what it covers. A line
 * without a colon is shown whole rather than dropped.
 */
export function abstractCategories(text: string): { name: string; detail: string }[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const at = line.indexOf(":");
      return at === -1
        ? { name: line, detail: "" }
        : { name: line.slice(0, at).trim(), detail: line.slice(at + 1).trim() };
    });
}

export function CallForAbstractsCard({
  event,
  locale,
  as = "h2",
}: {
  event: EventRow;
  locale: Locale;
  as?: HeadingTag;
}) {
  const { callOpen, abstractsOpen } = callForAbstracts(event);
  if (!callOpen) return null;

  const t = getDictionary(locale);
  const categories = abstractCategories(tr(event, "abstract_categories", locale));
  const secretariat = event.secretariat_email.trim();
  const Heading = as;
  const Sub = below[as];

  return (
    <div className="rounded-lg border border-ink-200 bg-paper p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-4 border-b border-ink-200 pb-4">
        <div>
          <Heading className="font-semibold text-ink-950">{t.events.callForAbstracts}</Heading>
          <p className="mt-0.5 text-[0.8125rem] text-ink-600">{t.events.callForAbstractsLead}</p>
        </div>
        <StatusPill
          label={abstractsOpen ? t.events.callOpen : t.events.callClosed}
          tone={abstractsOpen ? "active" : "expired"}
        />
      </div>

      {/*
        The deadline is the reason the card exists, so it gets the one tinted ground
        and the largest numeral. The time is a house rule, not a field: every deadline
        on this site closes at the end of that day in Ulaanbaatar.
      */}
      <div className="mt-5 rounded border border-copper-200 bg-copper-50 p-4">
        <div className="text-[0.75rem] font-semibold uppercase tracking-wide text-copper-800">
          {t.events.submissionDeadline}
        </div>
        <div className="tabular mt-1 text-h3 font-bold text-ink-950">
          {formatDate(event.abstract_deadline, locale)}
        </div>
        <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[0.8125rem] text-ink-600">
          <span>{t.events.deadlineTime}</span>
          <span>{t.events.deadlineZone}</span>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="mt-5">
          <Sub className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-900">
            {t.events.abstractCategories}
          </Sub>
          <ul className="mt-2.5 list-disc space-y-1.5 pl-4 text-[0.8125rem] leading-normal text-ink-600 marker:text-copper-600">
            {categories.map((category) => (
              <li key={category.name}>
                <span className="font-medium text-ink-900">
                  {category.name}
                  {category.detail && ":"}
                </span>
                {category.detail && ` ${category.detail}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 space-y-2.5">
        {abstractsOpen && secretariat && (
          <a
            href={`mailto:${secretariat}?subject=${encodeURIComponent(tr(event, "title", locale))}`}
            className="btn btn-primary w-full"
          >
            {t.events.submitAbstract} →
          </a>
        )}
        <div className={`grid gap-2 ${event.guidelines_url ? "grid-cols-2" : "grid-cols-1"}`}>
          {event.guidelines_url && (
            <a
              href={safeFileHref(event.guidelines_url) ?? "#"}
              className="btn btn-secondary text-[0.8125rem]"
            >
              {t.events.submissionGuidelines}
            </a>
          )}
          <Link
            href={localePath(locale, `/events/${event.slug}/register`)}
            className="btn btn-secondary text-[0.8125rem]"
          >
            {t.events.registrationDetails}
          </Link>
        </div>
      </div>

      {secretariat && (
        <div className="mt-5 border-t border-ink-200 pt-4 text-center text-[0.8125rem] text-ink-600">
          <span className="block">{t.events.secretariat}</span>
          <a
            href={`mailto:${secretariat}`}
            className="font-medium text-ink-900 transition-colors duration-100 hover:text-copper-700"
          >
            {secretariat}
          </a>
        </div>
      )}
    </div>
  );
}

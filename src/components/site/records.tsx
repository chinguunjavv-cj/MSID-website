import Link from "next/link";
import type { EventRow, Guideline, Locale, NewsPost, Publication } from "@/lib/db/types";
import { tr } from "@/lib/db/types";
import { formatDateNumeric, formatDateRange, truncate } from "@/lib/format";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localePath } from "@/lib/i18n/config";
import { StatusPill, guidelineTone } from "@/components/ui/Primitives";

/**
 * The register row is the site's signature component: a date column, a title, and a
 * status — aligned on one grid, tabular numerals, hairline rules. Guidelines, events,
 * publications and news all read as records of the same register rather than as four
 * different card grids.
 */

export function GuidelineRow({
  guideline,
  locale,
}: {
  guideline: Guideline;
  locale: Locale;
}) {
  const t = getDictionary(locale);
  const status = guideline.status as keyof typeof t.guidelines.status;

  return (
    <Link
      href={localePath(locale, `/guidelines/${guideline.slug}`)}
      className="register-row group"
    >
      <div className="flex items-center gap-3 md:block">
        <time
          dateTime={guideline.effective_from ?? guideline.approved_on ?? undefined}
          className="text-small font-semibold text-ink-800"
        >
          {formatDateNumeric(guideline.effective_from ?? guideline.approved_on) || "—"}
        </time>
        {guideline.code && (
          <p className="text-[0.8125rem] text-ink-600 md:mt-1">{guideline.code}</p>
        )}
      </div>

      <div className="min-w-0">
        <p className="text-body font-semibold text-ink-900 group-hover:text-copper-700">
          {tr(guideline, "title", locale)}
        </p>
        {/* Same treatment as the event and news summaries beside it. Setting this one in
            Literata added a text style used exactly once, and made guideline rows read
            differently from every other record in the same register. */}
        {tr(guideline, "summary", locale) && (
          <p className="mt-1.5 max-w-[62ch] text-small text-ink-600">
            {truncate(tr(guideline, "summary", locale), 160)}
          </p>
        )}
        {tr(guideline, "category", locale) && (
          <p className="mt-2 text-[0.8125rem] text-ink-600">
            {t.guidelines.category}: {tr(guideline, "category", locale)}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 md:flex-col md:items-end">
        <StatusPill
          label={t.guidelines.status[status] ?? guideline.status}
          tone={guidelineTone(guideline.status)}
        />
        <span className="tabular text-[0.8125rem] text-ink-600">
          v{guideline.version}
        </span>
      </div>
    </Link>
  );
}

export function EventRow_({ event, locale }: { event: EventRow; locale: Locale }) {
  const t = getDictionary(locale);
  const kind = event.kind as keyof typeof t.events.kind;

  return (
    <Link href={localePath(locale, `/events/${event.slug}`)} className="register-row group">
      <div className="flex items-center gap-3 md:block">
        <time dateTime={event.starts_on ?? undefined} className="text-small font-semibold text-ink-800">
          {formatDateNumeric(event.starts_on) || "—"}
        </time>
        <p className="text-[0.8125rem] text-ink-600 md:mt-1">{t.events.kind[kind]}</p>
      </div>

      <div className="min-w-0">
        <p className="text-body font-semibold text-ink-900 group-hover:text-copper-700">
          {tr(event, "title", locale)}
        </p>
        {tr(event, "summary", locale) && (
          <p className="mt-1.5 max-w-[62ch] text-small text-ink-600">
            {truncate(tr(event, "summary", locale), 160)}
          </p>
        )}
        {(tr(event, "venue", locale) || tr(event, "city", locale)) && (
          <p className="mt-2 text-[0.8125rem] text-ink-600">
            {[tr(event, "venue", locale), tr(event, "city", locale)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>

      <div className="text-small text-ink-600 md:text-right">
        {formatDateRange(event.starts_on, event.ends_on, locale)}
      </div>
    </Link>
  );
}

export function PublicationRow({
  publication,
  locale,
}: {
  publication: Publication;
  locale: Locale;
}) {
  const t = getDictionary(locale);
  const kind = publication.kind as keyof typeof t.publications.kind;

  return (
    <Link
      href={localePath(locale, `/publications/${publication.slug}`)}
      className="register-row group"
    >
      <div className="flex items-center gap-3 md:block">
        <time dateTime={publication.published_on ?? undefined} className="text-small font-semibold text-ink-800">
          {formatDateNumeric(publication.published_on) || "—"}
        </time>
        <p className="text-[0.8125rem] text-ink-600 md:mt-1">
          {t.publications.kind[kind]}
        </p>
      </div>

      <div className="min-w-0">
        <p className="text-body font-semibold text-ink-900 group-hover:text-copper-700">
          {tr(publication, "title", locale)}
        </p>
        {tr(publication, "authors", locale) && (
          <p className="mt-1.5 text-small text-ink-700">
            {tr(publication, "authors", locale)}
          </p>
        )}
        {tr(publication, "journal", locale) && (
          <p className="mt-1 text-[0.8125rem] text-ink-600">
            {tr(publication, "journal", locale)}
            {publication.volume && ` ${publication.volume}`}
            {publication.issue && `(${publication.issue})`}
            {publication.pages && `: ${publication.pages}`}
          </p>
        )}
      </div>

      <div className="text-[0.8125rem] text-ink-600 md:text-right">
        {publication.doi && <span className="tabular">{publication.doi}</span>}
      </div>
    </Link>
  );
}

export function NewsRow({ post, locale }: { post: NewsPost; locale: Locale }) {
  return (
    <Link href={localePath(locale, `/news/${post.slug}`)} className="register-row group">
      <time
        dateTime={post.published_at ?? post.created_at}
        className="text-small font-semibold text-ink-800"
      >
        {formatDateNumeric(post.published_at ?? post.created_at)}
      </time>

      <div className="min-w-0 md:col-span-2">
        <p className="text-body font-semibold text-ink-900 group-hover:text-copper-700">
          {tr(post, "title", locale)}
        </p>
        {tr(post, "excerpt", locale) && (
          <p className="mt-1.5 max-w-[68ch] text-small text-ink-600">
            {truncate(tr(post, "excerpt", locale), 180)}
          </p>
        )}
      </div>
    </Link>
  );
}

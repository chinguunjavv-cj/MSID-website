import Link from "next/link";
import type { Locale } from "@/lib/db/types";
import { toParagraphs } from "@/lib/format";
import { getDictionary } from "@/lib/i18n/dictionaries";

/* -------------------------------------------------------------------------- */
/* Page header                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Standard interior page header: an ink band with the title and an optional lead.
 * Consistent across every section so a visitor always knows where the page starts.
 */
export function PageHeader({
  title,
  lead,
  meta,
  breadcrumb,
}: {
  title: string;
  lead?: string;
  meta?: React.ReactNode;
  breadcrumb?: { label: string; href: string }[];
}) {
  return (
    <div className="on-dark">
      <div className="shell py-12 md:py-16">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-ink-400">
              {breadcrumb.map((crumb, index) => (
                <li key={crumb.href} className="flex items-center gap-2">
                  {/* Separators sit between crumbs, never after the last one. */}
                  {index > 0 && <span aria-hidden>/</span>}
                  <Link
                    href={crumb.href}
                    className="transition-colors duration-100 hover:text-paper"
                  >
                    {crumb.label}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <h1 className="max-w-[20ch] text-h1 font-bold text-paper">{title}</h1>

        {lead && (
          <p className="mt-5 max-w-[58ch] text-[1.0625rem] text-ink-300 md:text-lg">
            {lead}
          </p>
        )}

        {meta && <div className="mt-7">{meta}</div>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Section heading                                                             */
/* -------------------------------------------------------------------------- */

export function SectionHead({
  title,
  lead,
  action,
  id,
  tone = "light",
}: {
  title: string;
  lead?: string;
  action?: React.ReactNode;
  id?: string;
  tone?: "light" | "dark";
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
      <div className="max-w-[52ch]">
        <h2 id={id} className="text-h2 font-bold">
          {title}
        </h2>
        {lead && (
          <p
            className={`mt-3 ${tone === "dark" ? "text-ink-300" : "text-ink-600"}`}
          >
            {lead}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Prose                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Renders admin-authored plain text as paragraphs. Content is stored as text and never
 * as HTML, so there is nothing to sanitise and no injection surface.
 */
export function Prose({
  body,
  className = "",
}: {
  body: string;
  className?: string;
}) {
  const paragraphs = toParagraphs(body);
  if (paragraphs.length === 0) return null;

  return (
    <div className={`reading measure ${className}`}>
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}

/** Plain-text list: one item per line. Used for member benefits and similar. */
export function ProseList({ body }: { body: string }) {
  const items = toParagraphs(body);
  if (items.length === 0) return null;

  return (
    <ul className="register mt-6">
      {items.map((item, index) => (
        <li
          key={index}
          className="flex gap-4 border-b border-ink-200 py-4 text-ink-800"
        >
          <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 bg-copper-600" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Status pill                                                                 */
/* -------------------------------------------------------------------------- */

export type PillTone = "active" | "pending" | "expired" | "info" | "neutral";

/** Status always carries a word. The colour is reinforcement, never the message. */
export function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: PillTone;
}) {
  return <span className={`pill pill-${tone}`}>{label}</span>;
}

export function guidelineTone(status: string): PillTone {
  if (status === "published") return "active";
  if (status === "superseded") return "expired";
  if (status === "review") return "pending";
  return "neutral";
}

export function paymentTone(status: string): PillTone {
  if (status === "paid") return "active";
  if (status === "pending") return "pending";
  if (status === "cancelled" || status === "refunded") return "expired";
  return "neutral";
}

export function membershipTone(status: string): PillTone {
  if (status === "active") return "active";
  if (status === "pending") return "pending";
  if (status === "expired" || status === "rejected") return "expired";
  return "neutral";
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A young society has empty sections. Every one of them says what will appear here and
 * what to do meanwhile, so it reads as "not yet published" rather than as broken.
 */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-t border-ink-200 py-14">
      <p className="text-[1.0625rem] font-semibold text-ink-800">{title}</p>
      {hint && <p className="mt-2 max-w-[54ch] text-ink-600">{hint}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Translation notice                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Shown when a record exists but has no text in the visitor's language. The fallback
 * content is still displayed; this only explains why it is in the other language.
 */
/**
 * Shown on a page that is only visible because a member of staff is signed in.
 *
 * Without it, previewing an unpublished record looks exactly like the live page, and an
 * editor can believe a draft is published when the public still sees a 404.
 */
export function StaffPreviewNotice({
  locale,
  status,
}: {
  locale: Locale;
  status: string;
}) {
  const mn = locale === "mn";
  const label = mn
    ? status === "draft"
      ? "төсөл"
      : "архивласан"
    : status;

  return (
    <div className="border-b-2 border-status-pending bg-status-pending-bg px-4 py-2 text-center text-small">
      {mn
        ? `Энэ хуудас ${label} төлөвтэй байна. Зөвхөн та харж байгаа бөгөөд зочдод харагдахгүй.`
        : `This page is ${label}. Only signed-in staff can see it; visitors get a “not found” page.`}
    </div>
  );
}

export function TranslationNotice({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  return (
    <p className="pill pill-info mb-5" role="status">
      {t.notTranslated}
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* Pagination                                                                  */
/* -------------------------------------------------------------------------- */

export function Pagination({
  page,
  totalPages,
  hrefFor,
  labels,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
  labels: { previous: string; next: string; page: string; of: string };
}) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label={labels.page} className="mt-10 flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="btn btn-secondary">
          ← {labels.previous}
        </Link>
      ) : (
        <span />
      )}

      <p className="tabular text-small text-ink-600">
        {labels.page} {page} {labels.of} {totalPages}
      </p>

      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className="btn btn-secondary">
          {labels.next} →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* Form feedback                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Error summary at the top of a form.
 *
 * `title` is the "check the fields below" line and should only be passed when the form
 * actually has per-field errors. An account-level message — "your application is under
 * review" — reads as nonsense underneath it, so those render on their own.
 */
export function FormErrorSummary({
  title,
  errors,
}: {
  title?: string;
  errors: string[];
}) {
  if (errors.length === 0) return null;

  return (
    <div
      role="alert"
      className="mb-6 border border-status-expired/35 bg-status-expired-bg px-4 py-3"
    >
      {title && <p className="font-semibold text-status-expired">{title}</p>}
      {errors.length === 1 && !title ? (
        <p className="font-medium text-status-expired">{errors[0]}</p>
      ) : (
        <ul
          className={`list-disc space-y-0.5 pl-5 text-small text-status-expired ${
            title ? "mt-1.5" : ""
          }`}
        >
          {errors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Notice({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "active" | "pending";
}) {
  const border = {
    info: "border-status-info/30 bg-status-info-bg",
    active: "border-status-active/30 bg-status-active-bg",
    pending: "border-status-pending/30 bg-status-pending-bg",
  }[tone];

  return (
    <div className={`border px-4 py-3 text-small ${border}`} role="status">
      {children}
    </div>
  );
}

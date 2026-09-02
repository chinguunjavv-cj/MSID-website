import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/lib/db/types";
import { toParagraphs } from "@/lib/format";
import { getDictionary } from "@/lib/i18n/dictionaries";

/* -------------------------------------------------------------------------- */
/* Page header                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Standard interior page header: the page's name, on paper, over a hairline.
 *
 * This was a drenched ink band carrying the title at h1/bold in white. On a page called
 * "Удирдах зөвлөл" that is a wall of black shouting two words, and it repeated on every
 * interior page — the loudest element on the site was its least informative one
 * (Chinguun, August 2026). A heading does not need a stage; it needs to be first.
 *
 * The rule beneath it does the work the band was doing: it says where the page starts.
 */
export function PageHeader({
  title,
  lead,
  meta,
  breadcrumb,
  image,
}: {
  title: string;
  lead?: string;
  meta?: React.ReactNode;
  breadcrumb?: { label: string; href: string }[];
  /**
   * The optional photographic ground, from the `section_banner` setting by way of
   * `SectionHeader`. Set, the header joins the home page's dark register: the same
   * shadowed record treatment, shorter. Empty, this renders type on paper exactly as
   * it did before the setting existed.
   *
   * Decorative by construction — `aria-hidden`, empty alt — because the h1 beneath it
   * names the page and a band of steppe is not information a screen reader needs read
   * aloud. The scrim is deliberately heavier than the hero's: an administrator can
   * point this at any photograph, and a header that fails its contrast the day someone
   * uploads a bright one is a header that cannot be trusted.
   */
  image?: string | null;
}) {
  const dark = Boolean(image);

  return (
    <div
      className={
        dark
          ? "on-dark relative overflow-hidden border-b border-ink-200"
          : "border-b border-ink-200"
      }
    >
      {dark && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <Image
            src={image as string}
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-[50%_35%]"
          />
          {/*
            Two layers, the hero's strategy at a shorter height: a flat bed that keeps
            the photograph readable as a photograph, and a left-weighted gradient that
            deepens it where the title and lead actually sit. Together they hold about
            71% ink under the text — enough that paper type clears AA even if an
            administrator points this at a bright photograph — and fall to 55% on the
            open right, where the picture can still be seen. A single heavy scrim was
            tried first and turned the band into the wall of black this header was
            redesigned away from in August.
          */}
          <div className="absolute inset-0 bg-ink-950/55" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950/35 to-transparent" />
        </div>
      )}

      <div className="shell relative pt-10 pb-8 md:pt-14 md:pb-10">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-4">
            <ol
              className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] ${
                dark ? "text-ink-300" : "text-ink-600"
              }`}
            >
              {breadcrumb.map((crumb, index) => (
                <li key={crumb.href} className="flex items-center gap-2">
                  {/* Separators sit between crumbs, never after the last one. */}
                  {index > 0 && (
                    <span aria-hidden className={dark ? "text-ink-500" : "text-ink-400"}>
                      /
                    </span>
                  )}
                  <Link
                    href={crumb.href}
                    className={`transition-colors duration-100 ${
                      dark ? "hover:text-copper-400" : "hover:text-copper-700"
                    }`}
                  >
                    {crumb.label}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <h1
          className={`max-w-[24ch] text-h2 font-semibold ${
            dark ? "text-paper" : "text-ink-950"
          }`}
        >
          {title}
        </h1>

        {lead && (
          <p
            className={`mt-4 max-w-[76ch] text-pretty ${
              dark ? "text-ink-200" : "text-ink-600"
            }`}
          >
            {lead}
          </p>
        )}

        {meta && <div className="mt-5">{meta}</div>}
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
        <h2 id={id} className="text-h2 font-semibold">
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
 *
 * Single newlines inside a paragraph are preserved as line breaks. Blank lines separate
 * paragraphs; a single newline is a deliberate break by whoever wrote the text, and
 * collapsing it ran the President's three-line sign-off together into one sentence.
 *
 * A paragraph the author broke into lines gets those lines hung: each one starts at the
 * margin and its wrapped continuation is indented under the text. Rendered flat, the
 * call for abstracts read as a wall on a phone — "3. Бүтэц – үндэслэл, зорилго," wrapped
 * to "материал арга зүй, үр дүн, дүгнэлт." hard against the margin, indistinguishable
 * from the start of item 4. Nothing changes for a line that does not wrap, or for an
 * ordinary paragraph of continuous prose, which is why the hang is applied per authored
 * line rather than to the paragraph.
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
      {paragraphs.map((paragraph, index) => {
        const lines = paragraph.split("\n");
        if (lines.length === 1) return <p key={index}>{paragraph}</p>;

        return (
          <p key={index}>
            {lines.map((line, lineIndex) => (
              <span key={lineIndex} className="block pl-[1.6em] -indent-[1.6em]">
                {line}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Plain-text list: one item per line. Used for member benefits and similar.
 *
 * `tone` follows the same convention as SectionHead. On an ink ground the hairlines
 * have to come down to a transparency of paper — ink-200 is a near-white line and
 * reads as a bright rule against ink-950 — and the copper mark moves up the ramp to
 * the step DESIGN.md reserves for marks on ink.
 */
export function ProseList({
  body,
  tone = "light",
}: {
  body: string;
  tone?: "light" | "dark";
}) {
  const items = toParagraphs(body);
  if (items.length === 0) return null;

  const dark = tone === "dark";

  return (
    <ul
      className={`mt-6 border-t ${dark ? "border-white/15" : "border-ink-200"}`}
    >
      {items.map((item, index) => (
        <li
          key={index}
          className={`flex gap-4 border-b py-4 ${
            dark ? "border-white/15 text-ink-200" : "border-ink-200 text-ink-800"
          }`}
        >
          <span
            aria-hidden
            className={`mt-2.5 h-1.5 w-1.5 shrink-0 ${
              dark ? "bg-copper-400" : "bg-copper-600"
            }`}
          />
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
    /*
      Compact on purpose. A section with nothing in it should not reserve as much room
      as a full one — with the section's own padding around it, py-10 here left a
      three-line notice floating in some 240px of white.
    */
    <div className="border-t border-ink-200 py-7">
      <p className="text-body font-semibold text-ink-800">{title}</p>
      {hint && <p className="mt-1.5 max-w-[54ch] text-ink-600">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page-level notices                                                          */
/* -------------------------------------------------------------------------- */

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
        ? `Энэ хуудас ${label} төлөвтэй байна. Үүнийг зөвхөн та харж байгаа бөгөөд зочдод харагдахгүй.`
        : `This page is ${label}. Only signed-in staff can see it; visitors get a “not found” page.`}
    </div>
  );
}

/**
 * Shown when a record exists but has no text in the visitor's language. The fallback
 * content is still displayed; this only explains why it is in the other language.
 */
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

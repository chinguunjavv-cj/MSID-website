import type { Locale } from "@/lib/db/types";

/**
 * Date and number formatting. Mongolian conventions differ from English enough that
 * `Intl` alone is not sufficient — Mongolian writes dates as
 * "2026 оны 6 дугаар сарын 25", with an ordinal particle that changes with the month
 * number's final digit.
 */

/**
 * The ordinal particle for Mongolian month numbers. Selected by the final digit
 * following vowel harmony: дугаар after back-vowel numerals, дүгээр after front-vowel
 * ones. 1 (нэг), 4 (дөрөв), 9 (ес) and 10 (арав) take дүгээр.
 */
function monthParticle(month: number): string {
  return [1, 4, 9, 10].includes(month) ? "дүгээр" : "дугаар";
}

const EN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Parses a `YYYY-MM-DD` or ISO datetime string without timezone drift. */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "2026 оны 6 дугаар сарын 25" / "25 June 2026" */
export function formatDate(value: string | null | undefined, locale: Locale): string {
  const date = parseDate(value);
  if (!date) return "";
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return locale === "mn"
    ? `${y} оны ${m} ${monthParticle(m)} сарын ${d}`
    : `${d} ${EN_MONTHS[m - 1]} ${y}`;
}

/** "2026.06.25" in both languages — for tables and register rows. */
export function formatDateNumeric(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

/**
 * Collapses a date range: same month renders as
 * "2026 оны 6 дугаар сарын 25–27" / "25–27 June 2026".
 */
export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
  locale: Locale,
): string {
  const from = parseDate(start);
  const to = parseDate(end);
  if (!from) return "";
  if (!to || from.getTime() === to.getTime()) return formatDate(start, locale);

  const sameYear = from.getFullYear() === to.getFullYear();
  const sameMonth = sameYear && from.getMonth() === to.getMonth();

  if (locale === "mn") {
    const m = from.getMonth() + 1;
    if (sameMonth) {
      return `${from.getFullYear()} оны ${m} ${monthParticle(m)} сарын ${from.getDate()}–${to.getDate()}`;
    }
    return `${formatDate(start, locale)} – ${formatDate(end, locale)}`;
  }

  if (sameMonth) {
    return `${from.getDate()}–${to.getDate()} ${EN_MONTHS[from.getMonth()]} ${from.getFullYear()}`;
  }
  if (sameYear) {
    return `${from.getDate()} ${EN_MONTHS[from.getMonth()]} – ${to.getDate()} ${EN_MONTHS[to.getMonth()]} ${from.getFullYear()}`;
  }
  return `${formatDate(start, locale)} – ${formatDate(end, locale)}`;
}

/** Whole tögrög with thin-space grouping: "250 000₮". */
export function formatMnt(amount: number, locale: Locale): string {
  const grouped = new Intl.NumberFormat(locale === "mn" ? "mn-MN" : "en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
  return locale === "mn" ? `${grouped}₮` : `${grouped} MNT`;
}

/** Whole days from today to `value`; negative when past. */
export function daysUntil(value: string | null | undefined): number | null {
  const date = parseDate(value);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86_400_000);
}

export function isPast(value: string | null | undefined): boolean {
  const days = daysUntil(value);
  return days !== null && days < 0;
}

/** `YYYY-MM-DD` for today, in local time. */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Renders a plain-text body as paragraphs. Admin-authored content is stored as plain
 * text with blank-line paragraph breaks — no HTML is ever interpolated, so there is no
 * injection surface.
 */
export function toParagraphs(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

/** Truncates on a word boundary, appending an ellipsis. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd()}…`;
}

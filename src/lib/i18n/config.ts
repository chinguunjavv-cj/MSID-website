import type { Locale } from "@/lib/db/types";

export const LOCALES = ["mn", "en"] as const;

/**
 * Mongolian is the site's language, not a translation of it. An un-prefixed request
 * lands here regardless of the browser's `Accept-Language`.
 */
export const DEFAULT_LOCALE: Locale = "mn";

/** Remembers a visitor's explicit choice from the МН / EN switcher. */
export const LOCALE_COOKIE = "msid_locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const LOCALE_LABELS: Record<Locale, string> = {
  mn: "МН",
  en: "EN",
};

/** `lang` attribute values. `mn-Cyrl-MN` tells the UA this is Cyrillic Mongolian. */
export const LOCALE_HTML_LANG: Record<Locale, string> = {
  mn: "mn-Cyrl-MN",
  en: "en",
};

export function isLocale(value: string | undefined): value is Locale {
  return value === "mn" || value === "en";
}

export function otherLocale(locale: Locale): Locale {
  return locale === "mn" ? "en" : "mn";
}

/** Prefixes an app-relative path with the locale segment. */
export function localePath(locale: Locale, path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}

/** Swaps the locale segment of a full pathname, preserving the rest of the route. */
export function swapLocaleInPath(pathname: string, next: Locale): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return `/${next}`;
  if (isLocale(segments[0])) {
    segments[0] = next;
    return `/${segments.join("/")}`;
  }
  return `/${next}/${segments.join("/")}`;
}

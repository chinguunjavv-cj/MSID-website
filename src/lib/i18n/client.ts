import type { Locale } from "@/lib/db/types";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "@/lib/i18n/config";

/**
 * Records the visitor's explicit language choice so later un-prefixed visits land on
 * it instead of the Mongolian default. Called from the МН / EN switcher.
 *
 * A plain cookie rather than a server action: the switcher is a real link, so the
 * choice must be written before navigation and must not delay it.
 */
export function rememberLocale(locale: Locale): void {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
}

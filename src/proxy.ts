import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE } from "@/lib/i18n/config";

/**
 * Locale routing only (Next.js 16 `proxy` convention, formerly `middleware`). Every
 * page lives under `/mn/...` or `/en/...`; a request with no locale prefix is
 * redirected to the visitor's best match.
 *
 * Authentication is deliberately *not* handled here. The proxy runs on the Edge
 * runtime, where `node:sqlite` is unavailable, so session validity is checked in the
 * layouts that guard `/admin` and `/portal` — which run on Node and can see the
 * database. A cookie check here would be advisory at best and easy to mistake for a
 * real guard.
 */

const PUBLIC_FILE = /\.[a-z0-9]+$/i;

/**
 * Which locale an un-prefixed request lands on.
 *
 * MSID is a Mongolian society writing primarily for Mongolian clinicians, so Mongolian
 * is the default for everyone — the site is not translated *into* Mongolian, it is
 * written in it. Browser `Accept-Language` is deliberately ignored: a Mongolian
 * clinician on an English-locale phone (very common) would otherwise be sent to the
 * English site by their handset's settings rather than by choice.
 *
 * A visitor who picks English with the МН/EN switcher is remembered: the switcher sets
 * `msid_locale`, and that choice wins over the default on later visits.
 */
function preferredLocale(request: NextRequest): string {
  const chosen = request.cookies.get(LOCALE_COOKIE)?.value;
  if (chosen && LOCALES.includes(chosen as (typeof LOCALES)[number])) return chosen;
  return DEFAULT_LOCALE;
}

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    pathname.startsWith("/brand") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const first = pathname.split("/")[1];
  if (LOCALES.includes(first as (typeof LOCALES)[number])) return NextResponse.next();

  const locale = preferredLocale(request);
  const target = new URL(
    `/${locale}${pathname === "/" ? "" : pathname}${search}`,
    request.url,
  );
  return NextResponse.redirect(target);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};

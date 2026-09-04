import type { Metadata, Viewport } from "next";
import { Commissioner, Literata } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";
import { LOCALES, LOCALE_HTML_LANG, isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isNoIndex, siteUrl } from "@/lib/site";

/**
 * Root layout. There is no `app/layout.tsx`; every route is locale-prefixed, so this
 * is the layout that owns `<html>` and `<body>`.
 *
 * Both families load the `cyrillic` and `cyrillic-ext` subsets. `cyrillic-ext` is the
 * one that carries Ө ө (U+04E8–9) and Ү ү (U+04AE–F); without it Mongolian renders
 * with fallback glyphs in the middle of words.
 */

/*
  Commissioner. Nunito was tried in its place (August 2026) and reverted: its rounded
  terminals and wide, soft counters read friendly rather than academic, which is the
  wrong voice for a society that publishes clinical standards. Commissioner's flatter,
  more upright humanist forms hold that register.

  Both families are variable fonts, and are loaded as such: no `weight` list, so each
  subset is one file carrying every weight, rather than one file per weight per subset.
  Listing weights had the home page fetching twelve font files; this is six.

  Three subsets, not four. `latin-ext` carries accented Latin — Polish, Turkish,
  Vietnamese — and nothing on a Mongolian-and-English site sets a glyph from it, while
  each subset is another file for both families. Literata's italic is not loaded
  either: no page uses an italic, by design (DESIGN.md, "no display serif italics").
*/
const commissioner = Commissioner({
  variable: "--font-commissioner",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  display: "swap",
});

const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  display: "swap",
});

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: "#2b241f",
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  const base = siteUrl();

  return {
    metadataBase: new URL(base),
    title: {
      default: `${t.org.name} · ${t.org.acronym}`,
      template: `%s · ${t.org.acronym}`,
    },
    description: t.org.tagline,
    /*
      Icons are not declared here. `src/app/icon.png` and `src/app/apple-icon.png` are
      picked up by the file convention, which fingerprints them for caching; naming
      them manually would point at unversioned paths and, worse, the scaffolded
      `favicon.ico` used to win over both.
    */
    robots: isNoIndex() ? { index: false, follow: false } : undefined,
    alternates: {
      canonical: `/${locale}`,
      languages: { "mn-MN": "/mn", en: "/en" },
    },
    openGraph: {
      type: "website",
      siteName: t.org.name,
      title: t.org.name,
      description: t.org.tagline,
      locale: locale === "mn" ? "mn_MN" : "en_US",
      images: [{ url: "/brand/msid-logo.jpg", width: 320, height: 320 }],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html
      lang={LOCALE_HTML_LANG[locale]}
      /*
        `scroll-behavior: smooth` in globals.css is there for in-page anchors, but
        without this attribute Next also animates the jump to the top on every route
        change — the new page scrolls up under you instead of starting at its head.
        Declaring it hands route transitions back to an instant scroll and leaves the
        anchors smooth.
      */
      data-scroll-behavior="smooth"
      className={`${commissioner.variable} ${literata.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}

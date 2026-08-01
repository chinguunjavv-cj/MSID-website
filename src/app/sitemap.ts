import type { MetadataRoute } from "next";
import { LOCALES } from "@/lib/i18n/config";
import {
  listPublishedGuidelines,
  listPublishedNews,
  listPublishedPublications,
  listAllEvents,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

const STATIC_PATHS = [
  "",
  "/about",
  "/about/mission",
  "/about/history",
  "/about/board",
  "/about/contact",
  "/events",
  "/events/past",
  "/news",
  "/publications",
  "/collaboration",
  "/guidelines",
  "/membership",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );

  const entry = (path: string, lastModified?: string): MetadataRoute.Sitemap[number] => ({
    url: `${base}/mn${path}`,
    lastModified: lastModified ? new Date(lastModified) : undefined,
    alternates: {
      languages: Object.fromEntries(
        LOCALES.map((locale) => [locale, `${base}/${locale}${path}`]),
      ),
    },
  });

  return [
    ...STATIC_PATHS.map((path) => entry(path)),
    ...listAllEvents()
      .filter((event) => event.status === "published")
      .map((event) => entry(`/events/${event.slug}`, event.updated_at)),
    ...listPublishedGuidelines().map((guideline) =>
      entry(`/guidelines/${guideline.slug}`, guideline.updated_at),
    ),
    ...listPublishedPublications().map((publication) =>
      entry(`/publications/${publication.slug}`, publication.updated_at),
    ),
    ...listPublishedNews(200).map((post) => entry(`/news/${post.slug}`, post.updated_at)),
  ];
}

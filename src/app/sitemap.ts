import type { MetadataRoute } from "next";
import { LOCALES } from "@/lib/i18n/config";
import { siteUrl } from "@/lib/site";
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
  "/events/abstracts",
  "/news",
  "/publications",
  "/collaboration",
  "/guidelines",
  "/membership",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const entry = (path: string, lastModified?: string): MetadataRoute.Sitemap[number] => ({
    url: `${base}/mn${path}`,
    lastModified: lastModified ? new Date(lastModified) : undefined,
    alternates: {
      languages: Object.fromEntries(
        LOCALES.map((locale) => [locale, `${base}/${locale}${path}`]),
      ),
    },
  });

  // Four independent reads, issued together rather than in sequence.
  const [events, guidelines, publications, news] = await Promise.all([
    listAllEvents(),
    listPublishedGuidelines(),
    listPublishedPublications(),
    listPublishedNews(200),
  ]);

  return [
    ...STATIC_PATHS.map((path) => entry(path)),
    ...events
      .filter((event) => event.status === "published")
      .map((event) => entry(`/events/${event.slug}`, event.updated_at)),
    ...guidelines.map((guideline) =>
      entry(`/guidelines/${guideline.slug}`, guideline.updated_at),
    ),
    ...publications.map((publication) =>
      entry(`/publications/${publication.slug}`, publication.updated_at),
    ),
    ...news.map((post) => entry(`/news/${post.slug}`, post.updated_at)),
  ];
}

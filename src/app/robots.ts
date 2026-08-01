import type { MetadataRoute } from "next";
import { isNoIndex, siteUrl } from "@/lib/site";

/*
  Evaluated per request, not at build. Otherwise the answer is frozen from whatever the
  build machine's environment looked like, and switching MSID_NOINDEX off at launch
  would silently keep serving "Disallow: /".
*/
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  // A client-review deployment carries sample content and MSID's name. Indexing that
  // would put invented guideline codes and congress dates into search results for a
  // medical society, so preview hosts refuse crawling outright.
  if (isNoIndex()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Authenticated and per-person surfaces. Each also sends `noindex` in its own
      // metadata; this only saves crawlers the round trip.
      disallow: [
        "/api/",
        "/mn/admin",
        "/en/admin",
        "/mn/portal",
        "/en/portal",
        "/mn/registration",
        "/en/registration",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}

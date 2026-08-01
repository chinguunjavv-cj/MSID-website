import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Authenticated and per-person surfaces. Each also sends `noindex` in its own
      // metadata; this only saves crawlers the round trip.
      disallow: ["/api/", "/mn/admin", "/en/admin", "/mn/portal", "/en/portal", "/mn/registration", "/en/registration"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}

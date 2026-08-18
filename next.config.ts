import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
    The site template uses React's <ViewTransition> to crossfade page content instead
    of hard-cutting it. Up to Next 16.2 that needed `experimental.viewTransition`; 16.3
    removed the flag as inert, and the component works on its own. It degrades to the
    browser default — an instant swap — wherever it is unsupported, so nothing depends
    on it working.
  */

  images: {
    /*
      Uploaded images are stored as absolute URLs when Vercel Blob is the storage
      backend, and `next/image` refuses remote hosts it has not been told about.
      Without this, every board photograph and event cover fails to render on Vercel.

      The filesystem backend stores `/uploads/…` paths, which are same-origin and need
      no entry here.
    */
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/**",
      },
    ],
  },

  /*
    Response headers.

    `frame-ancestors 'none'` is the one that matters most here: without it the admin
    panel can be loaded in an invisible iframe on another site and an administrator
    tricked into clicking "Delete" on a record they cannot see. X-Frame-Options says the
    same thing for older browsers.

    The enforced Content-Security-Policy is deliberately only `frame-ancestors`. A useful
    full policy has to allow the framed video players and Next's own inline bootstrap
    script, and a CSP written loosely enough to do that would mostly be decoration. The
    genuine XSS surface is small — nothing in this codebase renders HTML from the
    database — so the effort belongs in keeping it that way.

    A *report-only* full policy is sent alongside it. Browsers log violations to the
    console without blocking anything, so it costs nothing in production and turns the
    tightening-up into a matter of reading DevTools rather than guessing. Promote it to
    the enforced header once it has been quiet across the admin, portal and video pages
    (Next needs 'unsafe-inline' for its bootstrap script unless nonces are wired in).

    Strict-Transport-Security tells browsers that have seen the site once to refuse plain
    HTTP for it thereafter. Vercel sets it for *.vercel.app on its own; on a custom
    domain, Railway or a bare container nothing else does.
  */
  async headers() {
    const reportOnlyCsp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
      "font-src 'self' data:",
      "connect-src 'self'",
      // Every embed the site renders: the three video hosts `lib/video.ts` knows, the
      // OpenStreetMap contact map, and Google Maps in case `contact_map_url` is one.
      "frame-src https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com https://www.facebook.com https://www.openstreetmap.org https://www.google.com https://maps.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Content-Security-Policy-Report-Only", value: reportOnlyCsp },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Keeps the full URL of a members-only or registration page out of the
          // Referer sent to YouTube, Vimeo or a partner society's site.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

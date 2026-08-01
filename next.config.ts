import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

    There is no full Content-Security-Policy. A useful one has to allow the framed video
    players and Next's own inline bootstrap script, and a CSP written loosely enough to
    do that would mostly be decoration. The genuine XSS surface is small — nothing in
    this codebase renders HTML from the database — so the effort belongs in keeping it
    that way.
  */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
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

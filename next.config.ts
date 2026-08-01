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
};

export default nextConfig;

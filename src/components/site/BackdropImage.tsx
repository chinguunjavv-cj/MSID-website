import { BRAND_VARIANTS } from "@/lib/brand-images.generated";

/**
 * A full-bleed photographic background, served at the size the screen needs.
 *
 * With Vercel's optimiser answering 402, `next/image` can only serve an original, so a
 * phone downloaded the 1920px hero to fill a 375px screen. Lighthouse measured that hero
 * as the mobile LCP element at 8.3s. For a photograph `scripts/brand-variants.mjs` has
 * pre-generated, this renders a `<picture>` offering AVIF, then WebP, at four widths, and
 * the browser picks the smallest that covers the screen — about 68 KB instead of 367 KB
 * on a phone. For any other path (an administrator can point the setting at an upload),
 * it falls back to the original file exactly as before.
 *
 * `fetchPriority="high"` because this is the page's largest element: Lighthouse flagged
 * it missing, and `next/image`'s `priority` is deprecated in Next.js 16. `loading` stays
 * eager. The image is decorative by construction — the heading over it names the page.
 *
 * A plain `<img>` inside `<picture>` rather than `next/image`: a width-aware `loader`
 * must live in a client component, and a site-wide `loaderFile` would change how every
 * image on the site loads to fix two of them.
 */
export function BackdropImage({
  src,
  className,
  sizes = "100vw",
}: {
  src: string;
  /** Positioning and object-fit classes; the element fills its positioned parent. */
  className: string;
  sizes?: string;
}) {
  const variant = BRAND_VARIANTS[src];
  const img = (
    <img
      src={src}
      alt=""
      aria-hidden
      fetchPriority="high"
      loading="eager"
      className={`absolute inset-0 h-full w-full ${className}`}
    />
  );

  if (!variant) return img;

  const srcSet = (ext: "avif" | "webp") =>
    variant.widths
      .map((w) => `/brand/v/${variant.name}.${variant.hash}.${w}.${ext} ${w}w`)
      .join(", ");

  return (
    <picture>
      <source type="image/avif" srcSet={srcSet("avif")} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet("webp")} sizes={sizes} />
      {img}
    </picture>
  );
}

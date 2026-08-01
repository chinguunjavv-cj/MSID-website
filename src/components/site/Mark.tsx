import Image from "next/image";

/**
 * MSID's logo mark.
 *
 * The supplied asset is a JPEG: a copper intestine over a `MSID` wordmark, on a white
 * ground. Two treatments make it usable as a layout element:
 *
 * - The wordmark occupies the bottom ~27% of the square. Wherever the mark sits beside
 *   typeset "MSID" it would repeat itself, so the container crops it away by holding a
 *   320 × 234 box over a square image.
 * - `mix-blend-mode: multiply` drops the white ground. White multiplied by any base is
 *   that base, so the square disappears; the copper artwork multiplies into whatever it
 *   sits on. This is why the mark must only ever be placed on a light or copper
 *   surface — on ink it would vanish. Use the paper tile in the footer for dark grounds.
 */
export function MsidMark({
  className = "",
  imageClassName = "",
  priority = false,
  decorative = true,
  alt = "",
}: {
  /** Wrapper: sizing and positioning only. */
  className?: string;
  /**
   * Applied to the image itself. Opacity belongs here, not on the wrapper: opacity on
   * an ancestor creates a stacking context, which isolates `mix-blend-mode` from the
   * page behind it and leaves the white ground visible as a pale rectangle.
   */
  imageClassName?: string;
  priority?: boolean;
  decorative?: boolean;
  alt?: string;
}) {
  return (
    <span
      className={`block overflow-hidden ${className}`}
      style={{ aspectRatio: "320 / 234" }}
    >
      <Image
        src="/brand/msid-logo.jpg"
        alt={decorative ? "" : alt}
        aria-hidden={decorative || undefined}
        width={320}
        height={320}
        priority={priority}
        className={`h-auto w-full mix-blend-multiply select-none ${imageClassName}`}
      />
    </span>
  );
}

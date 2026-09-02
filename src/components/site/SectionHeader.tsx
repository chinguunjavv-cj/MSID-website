import { getSettings } from "@/lib/settings";
import { safeFileHref } from "@/lib/video";
import { PageHeader } from "@/components/ui/Primitives";

/**
 * A page header with the Society's banner behind it.
 *
 * Section landing pages use this; record pages use `PageHeader` directly and stay on
 * paper. A guideline, a news item, a registration receipt and the member portal are
 * documents — putting scenery behind a payment reference would be the brochure move
 * the site is built to avoid — while the pages the navigation points at are the ones
 * that carry the Society's face.
 *
 * Two sources, in order: the section's own `banner`, edited on its page in Хуудсууд,
 * and the shared `section_banner` setting behind everything that has not been given
 * one. A society with photographs of its own board, its own congress and its own
 * training can put each behind the page it documents; one that has none yet still gets
 * a coherent site from a single upload.
 *
 * `getSettings()` is cached per request and again in the data cache, so reading it here
 * rather than in thirteen pages costs nothing.
 */
export async function SectionHeader({
  banner,
  ...props
}: {
  title: string;
  lead?: string;
  meta?: React.ReactNode;
  breadcrumb?: { label: string; href: string }[];
  /** This section's own banner, when it has one. */
  banner?: string | null;
}) {
  const settings = await getSettings();
  const image = safeFileHref(banner) ?? safeFileHref(settings.section_banner);
  return <PageHeader {...props} image={image} />;
}

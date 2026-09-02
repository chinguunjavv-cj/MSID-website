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
 * The image is one setting, read here rather than in twelve pages: `getSettings()` is
 * cached per request and again in the data cache, so this costs nothing per page.
 */
export async function SectionHeader(props: {
  title: string;
  lead?: string;
  meta?: React.ReactNode;
  breadcrumb?: { label: string; href: string }[];
}) {
  const settings = await getSettings();
  return <PageHeader {...props} image={safeFileHref(settings.section_banner)} />;
}

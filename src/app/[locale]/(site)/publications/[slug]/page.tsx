import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasTranslation, tr } from "@/lib/db/types";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getPublicationBySlug } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import {
  PageHeader,
  Prose,
  StaffPreviewNotice,
  TranslationNotice,
} from "@/components/ui/Primitives";
import { safeExternalLink } from "@/lib/video";
import { currentUser, isStaff } from "@/lib/auth/session";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const publication = await getPublicationBySlug(slug);
  if (!publication) return {};
  return { title: tr(publication, "title", locale) };
}

export default async function PublicationPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  /*
    Staff see unpublished records here so "View on site" in the admin is a real
    preview. Everyone else gets the published-only query, and a draft 404s.
  */
  const staff = isStaff(await currentUser());
  const publication = await getPublicationBySlug(slug, staff);
  if (!publication) notFound();

  const t = getDictionary(locale);

  const facts = [
    { label: t.publications.authors, value: tr(publication, "authors", locale) },
    { label: t.publications.journal, value: tr(publication, "journal", locale) },
    { label: t.publications.volume, value: publication.volume },
    { label: t.publications.issue, value: publication.issue },
    { label: t.publications.pages, value: publication.pages },
    { label: t.common.date, value: formatDate(publication.published_on, locale) },
    { label: t.publications.doi, value: publication.doi },
  ].filter((fact) => fact.value);

  return (
    <>
      {publication.status !== "published" && (
        <StaffPreviewNotice locale={locale} status={publication.status} />
      )}

      <PageHeader
        title={tr(publication, "title", locale)}
        breadcrumb={[
          { label: t.publications.title, href: localePath(locale, "/publications") },
        ]}
        meta={
          tr(publication, "authors", locale) ? (
            <p className="text-ink-300">{tr(publication, "authors", locale)}</p>
          ) : undefined
        }
      />

      <div className="shell py-14 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16">
          <div>
            {!hasTranslation(publication, "abstract", locale) &&
              tr(publication, "abstract", locale) && <TranslationNotice locale={locale} />}
            <Prose body={tr(publication, "abstract", locale)} />
          </div>

          <aside>
            <div className="flex flex-col gap-3">
              {publication.file_path && (
                <a href={publication.file_path} download className="btn btn-primary">
                  {t.common.download}
                </a>
              )}
              {publication.external_url && (
                <a
                  href={safeExternalLink(publication.external_url) ?? "#"}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn btn-secondary"
                >
                  {t.publications.viewSource} ↗
                </a>
              )}
            </div>

            <dl className="mt-8 border-t-2 border-ink-900">
              {facts.map((fact) => (
                <div key={fact.label} className="border-b border-ink-200 py-3">
                  <dt className="text-label font-semibold text-ink-600">{fact.label}</dt>
                  <dd className="mt-1 font-medium text-ink-900">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </div>
    </>
  );
}

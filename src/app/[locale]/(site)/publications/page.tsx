import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tr } from "@/lib/db/types";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getPage, listPublishedPublications } from "@/lib/queries";
import { EmptyState, PageHeader } from "@/components/ui/Primitives";
import { PublicationRow } from "@/components/site/records";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).publications.title };
}

export default async function PublicationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const page = getPage("publications.intro");
  const publications = listPublishedPublications();

  return (
    <>
      <PageHeader
        title={tr(page, "title", locale) || t.publications.title}
        lead={tr(page, "body", locale) || t.publications.lead}
      />

      <div className="shell py-14 md:py-20">
        {publications.length > 0 ? (
          <div className="register">
            {publications.map((publication) => (
              <PublicationRow
                key={publication.id}
                publication={publication}
                locale={locale}
              />
            ))}
          </div>
        ) : (
          <EmptyState title={t.publications.empty} hint={t.publications.emptyHint} />
        )}
      </div>
    </>
  );
}

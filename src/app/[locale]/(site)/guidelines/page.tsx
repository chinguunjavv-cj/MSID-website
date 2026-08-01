import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tr } from "@/lib/db/types";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getPage, listPublishedGuidelines } from "@/lib/queries";
import { EmptyState, PageHeader } from "@/components/ui/Primitives";
import { GuidelineRow } from "@/components/site/records";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).guidelines.title };
}

export default async function GuidelinesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const page = await getPage("guidelines.intro");
  const guidelines = await listPublishedGuidelines();

  const inForce = guidelines.filter((item) => item.status === "published");
  const superseded = guidelines.filter((item) => item.status === "superseded");

  return (
    <>
      <PageHeader
        title={tr(page, "title", locale) || t.guidelines.title}
        lead={tr(page, "body", locale) || t.guidelines.lead}
      />

      <div className="shell py-14 md:py-20">
        {guidelines.length === 0 ? (
          <EmptyState title={t.guidelines.empty} hint={t.guidelines.emptyHint} />
        ) : (
          <>
            {inForce.length > 0 && (
              <section>
                <h2 className="text-label font-semibold text-ink-600">
                  {t.guidelines.status.published}
                </h2>
                <div className="register mt-4">
                  {inForce.map((guideline) => (
                    <GuidelineRow
                      key={guideline.id}
                      guideline={guideline}
                      locale={locale}
                    />
                  ))}
                </div>
              </section>
            )}

            {superseded.length > 0 && (
              <section className="mt-16">
                <h2 className="text-label font-semibold text-ink-600">
                  {t.guidelines.status.superseded}
                </h2>
                <div className="register mt-4">
                  {superseded.map((guideline) => (
                    <GuidelineRow
                      key={guideline.id}
                      guideline={guideline}
                      locale={locale}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}

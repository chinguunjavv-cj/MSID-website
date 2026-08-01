import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { tr } from "@/lib/db/types";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getPage, listPartners } from "@/lib/queries";
import { EmptyState, PageHeader } from "@/components/ui/Primitives";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).collaboration.title };
}

export default async function CollaborationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const page = await getPage("collaboration.intro");
  const partners = await listPartners();

  return (
    <>
      <PageHeader
        title={tr(page, "title", locale) || t.collaboration.title}
        lead={tr(page, "body", locale) || t.collaboration.lead}
      />

      <div className="shell py-14 md:py-20">
        {partners.length > 0 ? (
          <ul className="register">
            {partners.map((partner) => {
              const kind = partner.kind as keyof typeof t.collaboration.kind;
              return (
                <li key={partner.id} className="register-row md:grid-cols-[11rem_minmax(0,1fr)_auto]">
                  <div>
                    {partner.logo ? (
                      <Image
                        src={partner.logo}
                        alt={tr(partner, "name", locale)}
                        width={220}
                        height={80}
                        className="h-10 w-auto object-contain"
                      />
                    ) : (
                      <p className="text-xl font-bold tracking-tight text-ink-900">
                        {partner.acronym}
                      </p>
                    )}
                    <p className="mt-1 text-[0.8125rem] text-ink-600">
                      {tr(partner, "country", locale)}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-[1.0625rem] font-semibold text-ink-900">
                      {tr(partner, "name", locale)}
                    </h2>
                    <p className="mt-1 text-[0.8125rem] text-ink-600">
                      {t.collaboration.kind[kind]}
                    </p>
                    {tr(partner, "description", locale) && (
                      <p className="mt-3 max-w-[62ch] text-ink-700">
                        {tr(partner, "description", locale)}
                      </p>
                    )}
                  </div>

                  {partner.url && (
                    <a
                      href={partner.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="btn btn-secondary self-start whitespace-nowrap"
                    >
                      {t.collaboration.visitSite} ↗
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title={t.collaboration.empty} />
        )}
      </div>
    </>
  );
}

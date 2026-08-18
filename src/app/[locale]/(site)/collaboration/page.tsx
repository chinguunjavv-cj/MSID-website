import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { tr } from "@/lib/db/types";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getPage, listPartners } from "@/lib/queries";
import { EmptyState, PageHeader } from "@/components/ui/Primitives";
import { safeExternalLink } from "@/lib/video";

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
                /*
                  The register row aligns its columns on the first text baseline, which
                  for a column that starts with an image is the image's underside — so
                  the name used to hang from the bottom of the logo, at a different height
                  for every partner. Here the row aligns to the top instead, the mark sits
                  in a fixed 3rem box, and the name is centred against that same box:
                  logo and name share one optical line whatever shape the mark is, and the
                  country, category and description hang beneath in order.
                */
                <li
                  key={partner.id}
                  className="register-row md:grid-cols-[11rem_minmax(0,1fr)_auto] md:items-start"
                >
                  <div>
                    <div className="flex h-12 items-center">
                      {partner.logo ? (
                        <Image
                          src={partner.logo}
                          alt={tr(partner, "name", locale)}
                          width={240}
                          height={96}
                          className="max-h-12 w-auto max-w-[9.5rem] object-contain object-left"
                        />
                      ) : (
                        <p className="text-xl font-bold tracking-tight text-ink-900">
                          {partner.acronym}
                        </p>
                      )}
                    </div>
                    {tr(partner, "country", locale) && (
                      <p className="mt-2 text-[0.8125rem] leading-snug text-ink-600">
                        {tr(partner, "country", locale)}
                      </p>
                    )}
                  </div>

                  <div className="min-w-0">
                    <h2 className="flex min-h-12 items-center text-[1.0625rem] font-semibold leading-snug text-ink-900 [text-wrap:balance]">
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
                      href={safeExternalLink(partner.url) ?? "#"}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="btn btn-secondary group/link mt-3 self-start whitespace-nowrap md:mt-0"
                    >
                      {t.collaboration.visitSite}
                      {/* The arrow steps outward on hover: the link leaves the site. */}
                      <span
                        aria-hidden
                        className="ml-1 inline-block transition-transform duration-[120ms] ease-[var(--ease-out-quart)] group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5"
                      >
                        ↗
                      </span>
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

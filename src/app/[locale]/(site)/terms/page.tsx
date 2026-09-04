import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tr } from "@/lib/db/types";
import { formatDate } from "@/lib/format";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getPage } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { Prose } from "@/components/ui/Primitives";
import { SectionHeader } from "@/components/site/SectionHeader";

/*
  The conditions a card-acquiring bank requires a merchant's site to publish before it
  will connect a payment gateway: what is sold, how it is delivered, on what terms it is
  paid for, when it is refunded, and who the seller legally is.

  The headings live here rather than in the database so that editing the wording in the
  admin cannot delete a condition the bank checks for. The wording under each is the
  Society's to change — refund windows are a decision for the board, not for this file.
*/
const SECTIONS = [
  { key: "terms.service", heading: "service" },
  { key: "terms.delivery", heading: "delivery" },
  { key: "terms.payment", heading: "payment" },
  { key: "terms.refund", heading: "refund" },
] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).terms.title };
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const [settings, ...pages] = await Promise.all([
    getSettings(),
    ...SECTIONS.map((section) => getPage(section.key)),
  ]);
  const entity = await getPage("terms.entity");

  // The page is only as current as its most recently edited section.
  const updated = [...pages, entity]
    .map((page) => page?.updated_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  const address =
    locale === "mn" ? settings.contact_address_mn : settings.contact_address_en;

  return (
    <>
      <SectionHeader title={t.terms.title} lead={t.terms.lead} />

      <div className="shell py-14 md:py-20">
        <div className="measure space-y-12">
          {SECTIONS.map((section, index) => {
            const body = tr(pages[index], "body", locale);
            if (!body) return null;
            return (
              <section key={section.key}>
                <h2 className="text-h3 font-bold text-ink-950">{t.terms[section.heading]}</h2>
                <Prose body={body} className="mt-4" />
              </section>
            );
          })}

          {/*
            The seller's identity comes from Settings rather than from prose, so the
            address and telephone on the terms can never drift from the ones in the
            footer and on the contact page — a bank reviewer checks that they match.
          */}
          <section>
            <h2 className="text-h3 font-bold text-ink-950">{t.terms.entity}</h2>
            <dl className="mt-4 grid gap-x-8 gap-y-3 text-body sm:grid-cols-[auto_minmax(0,1fr)]">
              <dt className="text-small text-ink-600">{t.terms.entityName}</dt>
              <dd className="text-ink-900">{t.org.name}</dd>

              <dt className="text-small text-ink-600">{t.terms.entityAddress}</dt>
              <dd className="text-ink-900">{address}</dd>

              <dt className="text-small text-ink-600">{t.terms.entityPhone}</dt>
              <dd className="tabular text-ink-900">
                <a
                  href={`tel:${settings.contact_phone.replace(/\s/g, "")}`}
                  className="transition-colors duration-100 hover:text-copper-700"
                >
                  {settings.contact_phone}
                </a>
              </dd>

              <dt className="text-small text-ink-600">{t.terms.entityEmail}</dt>
              <dd className="text-ink-900">
                <a
                  href={`mailto:${settings.contact_email}`}
                  className="transition-colors duration-100 hover:text-copper-700"
                >
                  {settings.contact_email}
                </a>
              </dd>
            </dl>

            {tr(entity, "body", locale) && (
              <Prose body={tr(entity, "body", locale)} className="mt-6" />
            )}
          </section>

          {updated && (
            <p className="border-t border-ink-200 pt-6 text-small text-ink-600">
              {t.terms.updated} {formatDate(updated, locale)}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

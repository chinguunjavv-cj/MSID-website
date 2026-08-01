import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tr } from "@/lib/db/types";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getPage } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { PageHeader, Prose } from "@/components/ui/Primitives";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).aboutNav.contact };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const page = getPage("about.contact");
  const settings = getSettings();

  const address =
    locale === "mn" ? settings.contact_address_mn : settings.contact_address_en;
  const hours = locale === "mn" ? settings.contact_hours_mn : settings.contact_hours_en;

  const rows = [
    { label: t.about.address, value: address },
    {
      label: t.about.phone,
      value: settings.contact_phone,
      href: `tel:${settings.contact_phone.replace(/\s/g, "")}`,
    },
    {
      label: t.about.email,
      value: settings.contact_email,
      href: `mailto:${settings.contact_email}`,
    },
    { label: t.about.hours, value: hours },
  ].filter((row) => row.value);

  return (
    <>
      <PageHeader title={tr(page, "title", locale) || t.about.contactTitle} />

      <div className="shell py-14 md:py-20">
        {tr(page, "body", locale) && (
          <Prose body={tr(page, "body", locale)} className="mb-12" />
        )}

        <dl className="register max-w-2xl">
          {rows.map((row) => (
            <div key={row.label} className="register-row md:grid-cols-[9rem_minmax(0,1fr)]">
              <dt className="text-label font-semibold text-ink-600">{row.label}</dt>
              <dd className="text-ink-900">
                {row.href ? (
                  <a
                    href={row.href}
                    className="text-copper-700 underline decoration-1 underline-offset-2 hover:text-copper-800"
                  >
                    {row.value}
                  </a>
                ) : (
                  row.value
                )}
              </dd>
            </div>
          ))}
        </dl>

        {settings.contact_map_url && (
          <div className="mt-12 max-w-4xl">
            <iframe
              src={settings.contact_map_url}
              title={t.about.address}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="aspect-video w-full border border-ink-200"
            />
          </div>
        )}

        {settings.facebook_url && (
          <p className="mt-10">
            <a
              href={settings.facebook_url}
              target="_blank"
              rel="noreferrer noopener"
              className="btn btn-secondary"
            >
              Facebook →
            </a>
          </p>
        )}
      </div>
    </>
  );
}

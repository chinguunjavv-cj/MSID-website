import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tr } from "@/lib/db/types";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getPage } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { formatDate } from "@/lib/format";
import { PageHeader, Prose } from "@/components/ui/Primitives";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).aboutNav.welcome };
}

export default async function WelcomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const page = await getPage("about.welcome");
  const settings = await getSettings();

  return (
    <>
      <PageHeader
        title={tr(page, "title", locale) || t.aboutNav.welcome}
        meta={
          <p className="text-small text-ink-400">
            {t.about.founded}{" "}
            <time dateTime={settings.founded_on} className="tabular text-ink-200">
              {formatDate(settings.founded_on, locale)}
            </time>
          </p>
        }
      />

      <div className="shell py-14 md:py-20">
        <Prose body={tr(page, "body", locale)} />
      </div>
    </>
  );
}

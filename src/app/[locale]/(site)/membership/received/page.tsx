import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui/Primitives";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).membership.applicationReceived, robots: { index: false } };
}

export default async function ReceivedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const settings = getSettings();

  return (
    <>
      <PageHeader
        title={t.membership.applicationReceived}
        lead={t.membership.applicationReceivedLead}
      />

      <div className="shell py-14 md:py-20">
        <div className="max-w-2xl">
          <p className="text-ink-700">
            {locale === "mn"
              ? "Асуух зүйл байвал нийгэмлэгтэй холбогдоно уу:"
              : "If you have any questions, please contact the Society:"}{" "}
            <a
              href={`mailto:${settings.contact_email}`}
              className="font-semibold text-copper-700 underline underline-offset-2"
            >
              {settings.contact_email}
            </a>
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={localePath(locale, "/")} className="btn btn-primary">
              {t.errors.goHome}
            </Link>
            <Link href={localePath(locale, "/events")} className="btn btn-secondary">
              {t.events.title}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

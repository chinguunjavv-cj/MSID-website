import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { tr } from "@/lib/db/types";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getPage } from "@/lib/queries";
import { PageHeader, Prose, ProseList } from "@/components/ui/Primitives";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).membership.title };
}

export default async function MembershipPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const intro = getPage("membership.intro");
  const benefits = getPage("membership.benefits");

  const types: (keyof typeof t.membership.type)[] = [
    "full",
    "associate",
    "trainee",
    "honorary",
  ];

  return (
    <>
      <PageHeader
        title={tr(intro, "title", locale) || t.membership.title}
        lead={tr(intro, "body", locale) || t.membership.lead}
        meta={
          <Link href={localePath(locale, "/membership/apply")} className="btn btn-on-dark">
            {t.membership.apply}
          </Link>
        }
      />

      <div className="shell py-14 md:py-20">
        <div className="grid gap-14 md:grid-cols-2 md:gap-20">
          <section>
            <h2 className="text-h3 font-bold">{t.membership.benefits}</h2>
            <ProseList body={tr(benefits, "body", locale)} />
          </section>

          <section>
            <h2 className="text-h3 font-bold">{t.membership.types}</h2>
            <dl className="register mt-6">
              {types.map((type) => (
                <div key={type} className="register-row md:grid-cols-[12rem_minmax(0,1fr)]">
                  <dt className="font-semibold text-ink-900">
                    {t.membership.type[type]}
                  </dt>
                  <dd className="text-ink-700">
                    {
                      {
                        full: locale === "mn"
                          ? "Гэдэсний эмгэгийн чиглэлээр ажилладаг мэргэжлийн эмч, эрдэмтэн."
                          : "Physicians and researchers practising in intestinal disease.",
                        associate: locale === "mn"
                          ? "Холбогдох салбарын эмч, эрүүл мэндийн бусад мэргэжилтэн."
                          : "Clinicians and health professionals in related fields.",
                        trainee: locale === "mn"
                          ? "Резидент эмч, магистр, докторант."
                          : "Residents and postgraduate students.",
                        honorary: locale === "mn"
                          ? "Удирдах зөвлөлийн шийдвэрээр олгоно."
                          : "Conferred by decision of the executive board.",
                      }[type]
                    }
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <div className="mt-16 border-t border-ink-200 pt-10">
          <Link href={localePath(locale, "/membership/apply")} className="btn btn-primary">
            {t.membership.apply}
          </Link>
          <p className="mt-4 text-small text-ink-600">
            {t.auth.hasAccount}{" "}
            <Link
              href={localePath(locale, "/login")}
              className="font-semibold text-copper-700 underline underline-offset-2"
            >
              {t.auth.login}
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}

import { notFound } from "next/navigation";
import { SectionNav } from "@/components/site/SectionNav";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function AboutLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const p = (path: string) => localePath(locale, path);

  return (
    <>
      <SectionNav
        label={t.nav.about}
        items={[
          { label: t.aboutNav.welcome, href: p("/about") },
          { label: t.aboutNav.mission, href: p("/about/mission") },
          { label: t.aboutNav.history, href: p("/about/history") },
          { label: t.aboutNav.board, href: p("/about/board") },
          { label: t.aboutNav.contact, href: p("/about/contact") },
        ]}
      />
      {children}
    </>
  );
}

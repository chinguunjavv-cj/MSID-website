import { notFound } from "next/navigation";
import { Masthead } from "@/components/site/Masthead";
import { Footer } from "@/components/site/Footer";
import { currentUser, isStaff } from "@/lib/auth/session";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { mainNav } from "@/lib/nav";

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const user = await currentUser();

  return (
    <>
      <Masthead
        locale={locale}
        nav={mainNav(locale)}
        signedIn={Boolean(user)}
        isStaff={isStaff(user)}
        adminLabel={locale === "mn" ? "Удирдлагын хэсэг" : "Admin"}
        labels={{
          orgName: t.org.name,
          memberArea: t.auth.memberArea,
          login: t.auth.login,
          menu: t.nav.menu,
          close: t.nav.close,
          openMenu: t.nav.openMenu,
          skipToContent: t.nav.skipToContent,
          switchTo: t.nav.switchTo,
          language: t.nav.language,
        }}
      />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer locale={locale} />
    </>
  );
}

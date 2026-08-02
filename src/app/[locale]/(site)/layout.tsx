import { Suspense } from "react";
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
      {/*
        `main` stays here rather than in the template, so the skip link's target survives
        navigation. The crossfade lives in template.tsx — see the note there.
      */}
      <main id="main" className="flex-1">
        {children}
      </main>

      {/*
        The footer reads the site settings, and it is the last thing on the page. Left
        unwrapped it makes the whole layout — masthead included — wait on that query
        before anything renders.
      */}
      <Suspense fallback={<div className="mt-24 border-t-2 border-copper-600" />}>
        <Footer locale={locale} />
      </Suspense>

      {/*
        Clearance for the fixed tab bar. A spacer here rather than padding on `body`,
        because `body` is shared with the admin — which has its own shell, no tab bar,
        and would just get 3.25rem of dead space at the bottom of every page.
      */}
      <div
        aria-hidden
        className="h-[calc(3.25rem+env(safe-area-inset-bottom))] shrink-0 nav:hidden"
      />
    </>
  );
}

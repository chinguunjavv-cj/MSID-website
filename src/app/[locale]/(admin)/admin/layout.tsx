import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { tr } from "@/lib/db/types";
import { currentUser, isStaff } from "@/lib/auth/session";
import { signOutAction } from "@/lib/actions/auth";
import { isLocale, localePath } from "@/lib/i18n/config";
import { ADMIN_SECTIONS } from "@/lib/nav";
import { dashboardStats } from "@/lib/queries";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  /*
    The real access check. The proxy cannot do this: it runs on the Edge runtime and
    cannot open the SQLite database, so it can only see that *a* cookie exists. Here
    the session is verified against the database on every admin request.
  */
  const user = await currentUser();
  if (!user) redirect(localePath(locale, "/login"));
  if (!isStaff(user)) redirect(localePath(locale, "/portal"));

  const stats = dashboardStats();
  const badges: Record<string, number> = {
    members: stats.pendingMembers,
    registrations: stats.unpaidRegistrations,
  };

  return (
    <AdminShell
      locale={locale}
      userName={tr(user, "name", locale) || user.email}
      signOut={signOutAction}
      labels={{
        title: locale === "mn" ? "Удирдлага" : "Admin",
        viewSite: locale === "mn" ? "Сайт харах" : "View site",
        signOut: locale === "mn" ? "Гарах" : "Sign out",
        menu: locale === "mn" ? "Цэс" : "Menu",
      }}
      items={ADMIN_SECTIONS.map((section) => ({
        key: section.key,
        href: localePath(locale, `/admin${section.href}`),
        label: locale === "mn" ? section.mn : section.en,
        badge: badges[section.key],
      }))}
    >
      {children}
    </AdminShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser, isStaff } from "@/lib/auth/session";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { LoginForm } from "@/components/site/LoginForm";
import { Notice } from "@/components/ui/Primitives";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).auth.login };
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ reset?: string }>;
}) {
  const { locale } = await params;
  const { reset } = await searchParams;
  if (!isLocale(locale)) notFound();

  const user = await currentUser();
  if (user) redirect(localePath(locale, isStaff(user) ? "/admin" : "/portal"));

  const t = getDictionary(locale);

  return (
    <div className="shell flex justify-center py-16 md:py-24">
      <div className="w-full max-w-md">
        <h1 className="text-h2 font-bold">{t.auth.loginTitle}</h1>
        <p className="mt-3 text-ink-600">{t.auth.loginLead}</p>

        {/* Set by the reset flow on its way here, so the change is confirmed where the
            reader lands rather than left to be inferred. */}
        {reset === "1" && (
          <div className="mt-6">
            <Notice tone="active">{t.auth.resetDone}</Notice>
          </div>
        )}

        <div className="mt-9">
          <LoginForm
            locale={locale}
            labels={{
              email: t.auth.email,
              password: t.auth.password,
              submit: t.auth.login,
              submitting: t.common.loading,
            }}
          />
        </div>

        <p className="mt-5 text-small">
          <Link
            href={localePath(locale, "/forgot-password")}
            className="text-copper-700 underline underline-offset-2 hover:text-copper-800"
          >
            {t.auth.forgotPassword}
          </Link>
        </p>

        <p className="mt-8 border-t border-ink-200 pt-6 text-small text-ink-600">
          {t.auth.noAccount}{" "}
          <Link
            href={localePath(locale, "/membership/apply")}
            className="font-semibold text-copper-700 underline underline-offset-2 hover:text-copper-800"
          >
            {t.membership.apply}
          </Link>
          <br />
          {/* Administrator accounts are created in the admin, never self-service. */}
          <span className="mt-2 block text-ink-600">{t.auth.adminAccountNote}</span>
        </p>
      </div>
    </div>
  );
}

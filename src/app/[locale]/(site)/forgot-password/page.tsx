import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser, isStaff } from "@/lib/auth/session";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isMailConfigured } from "@/lib/email/mailer";
import { getSettings } from "@/lib/settings";
import { ForgotPasswordForm } from "@/components/site/ResetForms";
import { Notice } from "@/components/ui/Primitives";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: getDictionary(locale).auth.resetTitle,
    robots: { index: false, follow: false },
  };
}

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const user = await currentUser();
  if (user) redirect(localePath(locale, isStaff(user) ? "/admin" : "/portal"));

  const t = getDictionary(locale);
  const settings = await getSettings();

  return (
    <div className="shell flex justify-center py-16 md:py-24">
      <div className="w-full max-w-md">
        <h1 className="text-h2 font-bold">{t.auth.resetTitle}</h1>
        <p className="mt-3 text-ink-600">{t.auth.resetLead}</p>

        <div className="mt-9">
          {/*
            Checked here as well as in the action. Showing a form that cannot work, and
            only saying so after it is filled in, wastes the reader's time at exactly
            the moment they are already locked out.
          */}
          {isMailConfigured() ? (
            <ForgotPasswordForm
              locale={locale}
              labels={{
                email: t.auth.email,
                submit: t.auth.resetSubmit,
                submitting: t.common.loading,
                sent: t.auth.resetSent,
              }}
            />
          ) : (
            <Notice tone="pending">
              {t.auth.resetUnavailable}{" "}
              {settings.contact_email && (
                <a
                  href={`mailto:${settings.contact_email}`}
                  className="font-semibold underline underline-offset-2"
                >
                  {settings.contact_email}
                </a>
              )}
            </Notice>
          )}
        </div>

        <p className="mt-8 border-t border-ink-200 pt-6 text-small">
          <Link
            href={localePath(locale, "/login")}
            className="font-semibold text-copper-700 underline underline-offset-2 hover:text-copper-800"
          >
            ← {t.auth.backToLogin}
          </Link>
        </p>
      </div>
    </div>
  );
}

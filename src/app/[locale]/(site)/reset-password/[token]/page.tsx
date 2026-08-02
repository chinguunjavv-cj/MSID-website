import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { resolveResetToken } from "@/lib/auth/reset";
import { ChoosePasswordForm } from "@/components/site/ResetForms";
import { Notice } from "@/components/ui/Primitives";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: isLocale(locale) ? getDictionary(locale).auth.resetChooseTitle : undefined,
    // A reset link must never reach an index, and never be followed by a crawler.
    robots: { index: false, follow: false },
  };
}

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);

  /*
    Checked before the form renders, so a stale link says so immediately rather than
    after the reader has chosen and typed a new password twice.
  */
  const userId = await resolveResetToken(token);

  return (
    <div className="shell flex justify-center py-16 md:py-24">
      <div className="w-full max-w-md">
        <h1 className="text-h2 font-bold">{t.auth.resetChooseTitle}</h1>

        {userId ? (
          <>
            <p className="mt-3 text-ink-600">{t.auth.resetChooseLead}</p>
            <div className="mt-9">
              <ChoosePasswordForm
                locale={locale}
                token={token}
                labels={{
                  password: t.auth.password,
                  passwordConfirm: t.auth.passwordConfirm,
                  passwordHint:
                    locale === "mn"
                      ? `Доод тал нь ${MIN_PASSWORD_LENGTH} тэмдэгт.`
                      : `At least ${MIN_PASSWORD_LENGTH} characters.`,
                  submit: t.auth.resetSubmitNew,
                  submitting: t.common.loading,
                }}
              />
            </div>
          </>
        ) : (
          <div className="mt-6">
            <Notice tone="pending">{t.auth.resetLinkInvalid}</Notice>
            <Link
              href={localePath(locale, "/forgot-password")}
              className="btn btn-secondary mt-6"
            >
              {t.auth.resetTitle}
            </Link>
          </div>
        )}

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

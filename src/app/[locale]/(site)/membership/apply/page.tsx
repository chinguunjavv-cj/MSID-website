import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { PageHeader } from "@/components/ui/Primitives";
import { MembershipForm } from "@/components/site/MembershipForm";
import { FormGuard } from "@/components/ui/FormGuard";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).auth.signupTitle };
}

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const user = await currentUser();
  if (user) redirect(localePath(locale, "/portal"));

  const t = getDictionary(locale);

  return (
    <>
      <PageHeader
        title={t.auth.signupTitle}
        lead={t.membership.lead}
        breadcrumb={[
          { label: t.membership.title, href: localePath(locale, "/membership") },
        ]}
      />

      <div className="shell py-14 md:py-20">
        <div className="max-w-2xl">
          <MembershipForm
          guard={<FormGuard />}
            locale={locale}
            membershipTypes={[
              { value: "full", label: t.membership.type.full },
              { value: "associate", label: t.membership.type.associate },
              { value: "trainee", label: t.membership.type.trainee },
            ]}
            labels={{
              errorTitle: t.errors.formHasErrors,
              personalSection: locale === "mn" ? "Хувийн мэдээлэл" : "Personal details",
              professionalSection:
                locale === "mn" ? "Мэргэжлийн мэдээлэл" : "Professional details",
              accountSection: locale === "mn" ? "Бүртгэл" : "Account",
              name: t.auth.name,
              email: t.auth.email,
              phone: t.registration.phone,
              degree: t.portal.degree,
              specialty: t.portal.specialty,
              institution: t.registration.institution,
              position: t.registration.position,
              membershipType: t.membership.types,
              password: t.auth.password,
              passwordConfirm: t.auth.passwordConfirm,
              passwordHint:
                locale === "mn"
                  ? `Доод тал нь ${MIN_PASSWORD_LENGTH} тэмдэгт.`
                  : `At least ${MIN_PASSWORD_LENGTH} characters.`,
              optional: t.common.optional,
              submit: t.membership.apply,
              submitting: t.common.saving,
            }}
          />
        </div>
      </div>
    </>
  );
}

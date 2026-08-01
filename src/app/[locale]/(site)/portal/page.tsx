import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { tr } from "@/lib/db/types";
import { currentUser, isStaff } from "@/lib/auth/session";
import { signOutAction } from "@/lib/actions/auth";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { getMemberRecord, listRegistrationsForUser } from "@/lib/queries";
import { formatDate, formatDateRange, formatMnt } from "@/lib/format";
import {
  EmptyState,
  PageHeader,
  StatusPill,
  membershipTone,
  paymentTone,
} from "@/components/ui/Primitives";
import {
  PasswordForm,
  ProfileForm,
  SignOutButton,
} from "@/components/site/ProfileForms";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: isLocale(locale) ? getDictionary(locale).portal.title : undefined,
    robots: { index: false, follow: false },
  };
}

export default async function PortalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const user = await currentUser();
  if (!user) redirect(localePath(locale, "/login"));

  const t = getDictionary(locale);
  const member = getMemberRecord(user.id);
  const registrations = listRegistrationsForUser(user.id);
  const name = tr(user, "name", locale) || user.email;

  const membershipRows = [
    { label: t.membership.memberNo, value: member?.member_no ?? "—" },
    {
      label: t.membership.types,
      value: member?.membership_type
        ? t.membership.type[member.membership_type]
        : "—",
    },
    { label: t.membership.joinedOn, value: formatDate(member?.joined_on, locale) || "—" },
    {
      label: t.membership.validUntil,
      value: formatDate(member?.valid_until, locale) || "—",
    },
  ];

  return (
    <>
      <PageHeader
        title={`${t.portal.welcome}, ${name}`}
        meta={
          <div className="flex flex-wrap items-center gap-3">
            {member?.membership_status && (
              <StatusPill
                label={t.membership.status[member.membership_status]}
                tone={membershipTone(member.membership_status)}
              />
            )}
            {isStaff(user) && (
              <Link href={localePath(locale, "/admin")} className="btn btn-on-dark">
                {locale === "mn" ? "Удирдлагын хэсэг" : "Admin"}
              </Link>
            )}
            <SignOutButton
              locale={locale}
              label={t.auth.logout}
              action={signOutAction}
              className="btn btn-outline-light"
            />
          </div>
        }
      />

      <div className="shell py-14 md:py-20">
        <section>
          <h2 className="text-h3 font-bold">{t.portal.membership}</h2>
          <dl className="register mt-6 max-w-2xl border-t-2 border-ink-900">
            {membershipRows.map((row) => (
              <div key={row.label} className="register-row md:grid-cols-[14rem_minmax(0,1fr)]">
                <dt className="text-label font-semibold text-ink-600">{row.label}</dt>
                <dd className="tabular font-semibold text-ink-900">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-16">
          <h2 className="text-h3 font-bold">{t.portal.registrations}</h2>
          {registrations.length > 0 ? (
            <div className="table-scroll mt-6">
              <table className="data-table">
                <caption className="sr-only">{t.portal.registrations}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t.registration.reference}</th>
                    <th scope="col">{t.events.title}</th>
                    <th scope="col">{t.common.date}</th>
                    <th scope="col">{t.registration.amountDue}</th>
                    <th scope="col">{t.common.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((registration) => (
                    <tr key={registration.id}>
                      <td className="tabular font-semibold">
                        <Link
                          href={localePath(
                            locale,
                            `/registration/${registration.reference}`,
                          )}
                          className="text-copper-700 underline underline-offset-2"
                        >
                          {registration.reference}
                        </Link>
                      </td>
                      <td>
                        {locale === "mn"
                          ? registration.event_title_mn || registration.event_title_en
                          : registration.event_title_en || registration.event_title_mn}
                      </td>
                      <td className="tabular whitespace-nowrap">
                        {formatDateRange(
                          registration.event_starts_on,
                          registration.event_ends_on,
                          locale,
                        )}
                      </td>
                      <td className="tabular whitespace-nowrap">
                        {formatMnt(registration.amount_mnt, locale)}
                      </td>
                      <td>
                        <StatusPill
                          label={
                            t.registration.paymentStatus[
                              registration.payment_status as keyof typeof t.registration.paymentStatus
                            ]
                          }
                          tone={paymentTone(registration.payment_status)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-6">
              <EmptyState
                title={t.portal.noRegistrations}
                action={
                  <Link href={localePath(locale, "/events")} className="btn btn-secondary">
                    {t.events.title}
                  </Link>
                }
              />
            </div>
          )}
        </section>

        <div className="mt-16 grid gap-14 border-t border-ink-200 pt-12 lg:grid-cols-2 lg:gap-20">
          <section>
            <h2 className="text-h3 font-bold">{t.portal.profile}</h2>
            <div className="mt-6">
              <ProfileForm
                locale={locale}
                defaults={{
                  name,
                  phone: member?.phone ?? "",
                  degree: member?.degree ?? "",
                  specialty: tr(member ?? null, "specialty", locale),
                  institution: tr(member ?? null, "institution", locale),
                  position: tr(member ?? null, "position", locale),
                }}
                labels={{
                  errorTitle: t.errors.formHasErrors,
                  saved: t.portal.profileUpdated,
                  name: t.auth.name,
                  phone: t.registration.phone,
                  degree: t.portal.degree,
                  specialty: t.portal.specialty,
                  institution: t.registration.institution,
                  position: t.registration.position,
                  optional: t.common.optional,
                  save: t.common.save,
                  saving: t.common.saving,
                }}
              />
            </div>
          </section>

          <section>
            <h2 className="text-h3 font-bold">{t.auth.password}</h2>
            <div className="mt-6">
              <PasswordForm
                locale={locale}
                labels={{
                  errorTitle: t.errors.formHasErrors,
                  saved: t.common.saved,
                  currentPassword:
                    locale === "mn" ? "Одоогийн нууц үг" : "Current password",
                  password: locale === "mn" ? "Шинэ нууц үг" : "New password",
                  passwordConfirm: t.auth.passwordConfirm,
                  passwordHint:
                    locale === "mn"
                      ? `Доод тал нь ${MIN_PASSWORD_LENGTH} тэмдэгт.`
                      : `At least ${MIN_PASSWORD_LENGTH} characters.`,
                  save: t.common.save,
                  saving: t.common.saving,
                }}
              />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

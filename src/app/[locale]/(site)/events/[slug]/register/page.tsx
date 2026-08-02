import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { tr } from "@/lib/db/types";
import { currentUser } from "@/lib/auth/session";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  getEventBySlug,
  getMemberRecord,
  listEventFees,
  registrationState,
} from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { formatDateRange, formatMnt, todayIso } from "@/lib/format";
import { qpayConfigured } from "@/lib/payments/qpay";
import { PageHeader } from "@/components/ui/Primitives";
import { RegistrationForm, type FeeOption } from "@/components/site/RegistrationForm";
import { FormGuard } from "@/components/ui/FormGuard";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const event = await getEventBySlug(slug);
  return {
    title: `${getDictionary(locale).events.register}${event ? ` · ${tr(event, "title", locale)}` : ""}`,
    robots: { index: false },
  };
}

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const t = getDictionary(locale);
  const state = registrationState(event);
  const settings = await getSettings();

  const user = await currentUser();
  const member = user ? await getMemberRecord(user.id) : undefined;
  const isMember = member?.membership_status === "active";

  if (state !== "open") {
    return (
      <>
        <PageHeader
          title={t.registration.title}
          breadcrumb={[
            { label: t.events.title, href: localePath(locale, "/events") },
            {
              label: tr(event, "title", locale),
              href: localePath(locale, `/events/${event.slug}`),
            },
          ]}
        />
        <div className="shell py-14 md:py-20">
          <p className="text-lg font-semibold text-ink-900">
            {state === "not_yet"
              ? t.events.registrationNotOpen
              : t.registration.closed}
          </p>
          <Link
            href={localePath(locale, `/events/${event.slug}`)}
            className="btn btn-secondary mt-6"
          >
            ← {tr(event, "title", locale)}
          </Link>
        </div>
      </>
    );
  }

  const earlyBirdActive = Boolean(
    event.early_bird_deadline && todayIso() <= event.early_bird_deadline,
  );

  // Non-members are not offered the member tier; the server re-checks anyway.
  const fees: FeeOption[] = (await listEventFees(event.id))
    .filter((fee) => (fee.audience === "member" ? isMember : true))
    .map((fee) => {
      const amount =
        earlyBirdActive && fee.early_amount_mnt != null
          ? fee.early_amount_mnt
          : fee.amount_mnt;
      return {
        id: fee.id,
        label: tr(fee, "label", locale),
        amount,
        formatted: formatMnt(amount, locale),
      };
    });

  const qpayAvailable = settings.qpay_enabled === "1" && qpayConfigured();

  return (
    <>
      <PageHeader
        title={t.registration.title}
        lead={tr(event, "title", locale)}
        breadcrumb={[
          { label: t.events.title, href: localePath(locale, "/events") },
          {
            label: tr(event, "title", locale),
            href: localePath(locale, `/events/${event.slug}`),
          },
        ]}
        meta={
          <p className="tabular text-small text-ink-300">
            {formatDateRange(event.starts_on, event.ends_on, locale)}
            {tr(event, "venue", locale) && ` · ${tr(event, "venue", locale)}`}
          </p>
        }
      />

      <div className="shell py-14 md:py-20">
        <div className="max-w-2xl">
          <RegistrationForm
          guard={<FormGuard />}
            locale={locale}
            slug={event.slug}
            fees={fees}
            qpayAvailable={qpayAvailable}
            isMember={isMember}
            defaults={{
              fullName: tr(member ?? null, "name", locale),
              email: user?.email ?? "",
              phone: member?.phone ?? "",
              institution: tr(member ?? null, "institution", locale),
              position: tr(member ?? null, "position", locale),
            }}
            labels={{
              errorTitle: t.errors.formHasErrors,
              step1: t.registration.step1,
              step2: t.registration.step2,
              additional: locale === "mn" ? "Нэмэлт мэдээлэл" : "Additional information",
              fullName: t.registration.fullName,
              email: t.registration.email,
              phone: t.registration.phone,
              institution: t.registration.institution,
              position: t.registration.position,
              country: t.registration.country,
              feeCategory: t.registration.feeCategory,
              amountDue: t.registration.amountDue,
              paymentInstructions: t.registration.paymentInstructions,
              bankTransfer: t.registration.bankTransfer,
              qpay: t.registration.qpay,
              abstractTitle: t.registration.abstractTitle,
              abstractHint: t.registration.abstractHint,
              notes: t.registration.notes,
              memberDiscountHint: t.registration.memberDiscountHint,
              optional: t.common.optional,
              submit: t.registration.submit,
              submitting: t.registration.submitting,
            }}
          />
        </div>
      </div>
    </>
  );
}

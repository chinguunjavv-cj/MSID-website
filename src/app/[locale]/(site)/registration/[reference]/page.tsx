import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { tr } from "@/lib/db/types";
import { get } from "@/lib/db";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getEventById, getRegistrationByReference } from "@/lib/queries";
import { getSettings, hasBankDetails } from "@/lib/settings";
import { formatDateRange, formatMnt } from "@/lib/format";
import {
  Notice,
  PageHeader,
  StatusPill,
  paymentTone,
} from "@/components/ui/Primitives";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; reference: string }>;
}): Promise<Metadata> {
  const { locale, reference } = await params;
  return {
    title: isLocale(locale)
      ? `${getDictionary(locale).registration.reference} ${reference}`
      : reference,
    robots: { index: false, follow: false },
  };
}

/**
 * Registration confirmation and payment instructions.
 *
 * Reachable by anyone holding the reference code, which is a 6-character random string
 * on top of the year — enough to be unguessable while letting a participant return to
 * their payment details from an email without an account. It deliberately shows no
 * personal data beyond what the participant themselves entered.
 */
export default async function RegistrationPage({
  params,
}: {
  params: Promise<{ locale: string; reference: string }>;
}) {
  const { locale, reference } = await params;
  if (!isLocale(locale)) notFound();

  const registration = await getRegistrationByReference(reference);
  if (!registration) notFound();

  const event = await getEventById(registration.event_id);
  const t = getDictionary(locale);
  const settings = await getSettings();
  const paid = registration.payment_status === "paid";

  const qpayPayload = registration.payment_ref
    ? await get<{ raw_payload: string }>(
        `SELECT raw_payload FROM payments
         WHERE registration_id = ? AND provider = 'qpay' AND provider_invoice_id = ?
         ORDER BY created_at DESC LIMIT 1`,
        registration.id,
        registration.payment_ref,
      )
    : undefined;

  let qpayQr: { qrImage?: string; urls?: { name: string; link: string }[] } | null = null;
  if (qpayPayload?.raw_payload) {
    try {
      const parsed = JSON.parse(qpayPayload.raw_payload) as {
        qrImage?: string;
        urls?: { name: string; link: string }[];
      };
      if (parsed.qrImage) qpayQr = parsed;
    } catch {
      qpayQr = null;
    }
  }

  const bankRows = [
    { label: t.registration.bankName, value: locale === "mn" ? settings.bank_name_mn : settings.bank_name_en },
    { label: t.registration.accountNumber, value: settings.bank_account_number },
    { label: t.registration.accountName, value: settings.bank_account_name },
    { label: t.registration.transferNote, value: registration.reference },
  ].filter((row) => row.value);

  return (
    <>
      <PageHeader
        title={t.registration.successTitle}
        lead={paid ? undefined : t.registration.successLead}
        meta={
          <div className="flex flex-wrap items-center gap-4">
            <StatusPill
              label={
                t.registration.paymentStatus[
                  registration.payment_status as keyof typeof t.registration.paymentStatus
                ]
              }
              tone={paymentTone(registration.payment_status)}
            />
            {event && (
              <p className="text-small text-ink-600">
                {tr(event, "title", locale)} ·{" "}
                <span className="tabular">
                  {formatDateRange(event.starts_on, event.ends_on, locale)}
                </span>
              </p>
            )}
          </div>
        }
      />

      <div className="shell py-14 md:py-20">
        <div className="max-w-2xl">
          <dl className="register border-t-2 border-ink-900">
            <div className="register-row md:grid-cols-[12rem_minmax(0,1fr)]">
              <dt className="text-label font-semibold text-ink-600">
                {t.registration.reference}
              </dt>
              <dd className="tabular text-h3 font-bold text-copper-700">
                {registration.reference}
              </dd>
            </div>
            <div className="register-row md:grid-cols-[12rem_minmax(0,1fr)]">
              <dt className="text-label font-semibold text-ink-600">
                {t.registration.fullName}
              </dt>
              <dd className="text-ink-900">{registration.full_name}</dd>
            </div>
            <div className="register-row md:grid-cols-[12rem_minmax(0,1fr)]">
              <dt className="text-label font-semibold text-ink-600">
                {t.registration.email}
              </dt>
              <dd className="text-ink-900">{registration.email}</dd>
            </div>
            <div className="register-row md:grid-cols-[12rem_minmax(0,1fr)]">
              <dt className="text-label font-semibold text-ink-600">
                {t.registration.amountDue}
              </dt>
              <dd className="tabular text-lg font-bold text-ink-900">
                {formatMnt(registration.amount_mnt, locale)}
              </dd>
            </div>
          </dl>

          {!paid && registration.amount_mnt > 0 && (
            <section className="mt-12">
              <h2 className="text-h3 font-bold">{t.registration.paymentInstructions}</h2>

              {qpayQr?.qrImage ? (
                <div className="mt-6">
                  <h3 className="text-label font-semibold text-ink-600">
                    {t.registration.qpay}
                  </h3>
                  <p className="mt-2 text-small text-ink-600">{t.registration.qpayHint}</p>
                  <Image
                    src={
                      qpayQr.qrImage.startsWith("data:")
                        ? qpayQr.qrImage
                        : `data:image/png;base64,${qpayQr.qrImage}`
                    }
                    alt=""
                    width={260}
                    height={260}
                    unoptimized
                    className="mt-4 h-64 w-64 border border-ink-200 bg-paper p-3"
                  />
                  {qpayQr.urls && qpayQr.urls.length > 0 && (
                    <ul className="mt-4 flex flex-wrap gap-2">
                      {qpayQr.urls.map((url) => (
                        <li key={url.name}>
                          <a
                            href={url.link}
                            className="btn btn-secondary px-3 py-1.5 text-[0.8125rem]"
                          >
                            {url.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : hasBankDetails(settings) ? (
                <div className="mt-6">
                  <h3 className="text-label font-semibold text-ink-600">
                    {t.registration.bankTransfer}
                  </h3>
                  <dl className="register mt-3">
                    {bankRows.map((row) => (
                      <div
                        key={row.label}
                        className="register-row md:grid-cols-[12rem_minmax(0,1fr)]"
                      >
                        <dt className="text-[0.8125rem] text-ink-600">{row.label}</dt>
                        <dd className="tabular font-semibold text-ink-900">
                          {row.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-5">
                    <Notice tone="pending">{t.registration.transferNoteHint}</Notice>
                  </div>
                </div>
              ) : (
                /*
                  MSID has not entered bank details in admin settings yet. Rather than
                  showing an empty table, the participant is told exactly what happens
                  next and how to reach the Society.
                */
                <div className="mt-6">
                  <Notice tone="pending">
                    {locale === "mn"
                      ? "Төлбөрийн мэдээллийг нийгэмлэгээс и-мэйлээр илгээх болно."
                      : "The Society will send payment details to you by email."}{" "}
                    <a
                      href={`mailto:${settings.contact_email}?subject=${encodeURIComponent(registration.reference)}`}
                      className="font-semibold underline underline-offset-2"
                    >
                      {settings.contact_email}
                    </a>
                  </Notice>
                </div>
              )}

              <p className="mt-6 text-small text-ink-600">{t.registration.afterPayment}</p>
            </section>
          )}

          <div className="mt-12 flex flex-wrap gap-3 no-print">
            {event && (
              <Link
                href={localePath(locale, `/events/${event.slug}`)}
                className="btn btn-secondary"
              >
                ← {tr(event, "title", locale)}
              </Link>
            )}
            <Link href={localePath(locale, "/portal")} className="btn btn-secondary">
              {t.portal.title}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

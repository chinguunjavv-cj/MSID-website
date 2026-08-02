"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { get, newId, run, transaction } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { referenceCode } from "@/lib/auth/password";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localePath } from "@/lib/i18n/config";
import { getEventBySlug, getEventFee, registrationState } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { formatDateRange, formatMnt, todayIso } from "@/lib/format";
import { tr } from "@/lib/db/types";
import { notify } from "@/lib/email/mailer";
import {
  newRegistrationNotice,
  registrationConfirmationMessage,
} from "@/lib/email/messages";
import { siteUrl } from "@/lib/site";
import { createQpayInvoice, qpayConfigured } from "@/lib/payments/qpay";
import type { FormState } from "@/lib/actions/types";

const localeSchema = z.enum(["mn", "en"]).catch("mn");

const schema = z.object({
  slug: z.string().trim().min(1),
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(160)),
  phone: z.string().trim().max(40),
  institution: z.string().trim().max(200),
  position: z.string().trim().max(160),
  country: z.string().trim().max(60),
  feeId: z.string().trim(),
  abstractTitle: z.string().trim().max(300),
  notes: z.string().trim().max(1000),
  paymentMethod: z.enum(["bank_transfer", "qpay"]).catch("bank_transfer"),
});

/**
 * Resolves what a participant actually owes.
 *
 * A fee tier can carry a discounted early-bird amount; it applies only while the
 * event's early-bird deadline has not passed. Computed on the server from the event
 * row — never taken from the form, so the posted price cannot be tampered with.
 */
function resolveAmount(
  fee: { amount_mnt: number; early_amount_mnt: number | null },
  earlyBirdDeadline: string | null,
): number {
  if (fee.early_amount_mnt == null) return fee.amount_mnt;
  if (!earlyBirdDeadline) return fee.amount_mnt;
  return todayIso() <= earlyBirdDeadline ? fee.early_amount_mnt : fee.amount_mnt;
}

export async function registerForEventAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = localeSchema.parse(formData.get("locale"));
  const t = getDictionary(locale);

  const parsed = schema.safeParse({
    slug: formData.get("slug"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    institution: formData.get("institution") ?? "",
    position: formData.get("position") ?? "",
    country: formData.get("country") ?? "MN",
    feeId: formData.get("feeId") ?? "",
    abstractTitle: formData.get("abstractTitle") ?? "",
    notes: formData.get("notes") ?? "",
    paymentMethod: formData.get("paymentMethod") ?? "bank_transfer",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "");
      fieldErrors[field] =
        field === "email" ? t.errors.invalidEmail : t.errors.fieldRequired;
    }
    return { errors: [t.errors.formHasErrors], fieldErrors };
  }

  const data = parsed.data;

  const event = await getEventBySlug(data.slug);
  if (!event) return { errors: [t.errors.notFoundLead] };
  if (registrationState(event) !== "open") return { errors: [t.registration.closed] };

  // One live registration per email per event.
  const existing = await get<{ id: string }>(
    `SELECT id FROM registrations
     WHERE event_id = ? AND email = ? COLLATE NOCASE AND attendance_status != 'cancelled'`,
    event.id,
    data.email,
  );
  if (existing) {
    return {
      errors: [t.registration.alreadyRegistered],
      fieldErrors: { email: t.registration.alreadyRegistered },
    };
  }

  const fee = data.feeId ? await getEventFee(data.feeId) : undefined;
  if (data.feeId && (!fee || fee.event_id !== event.id)) {
    return { errors: [t.errors.formHasErrors], fieldErrors: { feeId: t.errors.fieldRequired } };
  }

  const amount = fee ? resolveAmount(fee, event.early_bird_deadline) : 0;

  const user = await currentUser();
  const isMember =
    user?.role === "member" &&
    Boolean(
      await get(
        "SELECT user_id FROM member_profiles WHERE user_id = ? AND membership_status = 'active'",
        user.id,
      ),
    );

  const settings = await getSettings();
  const qpayAvailable = settings.qpay_enabled === "1" && qpayConfigured();

  let method: "bank_transfer" | "qpay" | "free" = "bank_transfer";
  if (amount === 0) method = "free";
  else if (data.paymentMethod === "qpay" && qpayAvailable) method = "qpay";

  const reference = referenceCode("MSID");
  const registrationId = newId();

  await transaction(async (tx) => {
    await tx.run(
      `INSERT INTO registrations
         (id, reference, event_id, user_id, fee_id, full_name, email, phone,
          institution, position, country, is_member, amount_mnt, payment_method,
          payment_status, abstract_title, notes, locale)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      registrationId,
      reference,
      event.id,
      user?.id ?? null,
      fee?.id ?? null,
      data.fullName,
      data.email,
      data.phone,
      data.institution,
      data.position,
      data.country,
      isMember ? 1 : 0,
      amount,
      method,
      method === "free" ? "paid" : "unpaid",
      data.abstractTitle,
      data.notes,
      locale,
    );

    await tx.run(
      `INSERT INTO audit_log (id, user_id, action, entity, entity_id, meta)
       VALUES (?, ?, 'registration.create', 'registration', ?, ?)`,
      newId(),
      user?.id ?? null,
      registrationId,
      JSON.stringify({ event: event.slug, amount, method }),
    );
  });

  // A QPay failure must not lose the registration: the row is already committed, so
  // the participant falls back to bank transfer rather than seeing an error.
  if (method === "qpay") {
    try {
      const invoice = await createQpayInvoice({
        reference,
        amountMnt: amount,
        description: `MSID ${event.slug} ${reference}`,
        payerEmail: data.email,
      });

      await run(
        `INSERT INTO payments
           (id, registration_id, provider, provider_invoice_id, amount_mnt, status, raw_payload)
         VALUES (?, ?, 'qpay', ?, ?, 'pending', ?)`,
        newId(),
        registrationId,
        invoice.invoiceId,
        amount,
        JSON.stringify(invoice),
      );

      await run(
        "UPDATE registrations SET payment_status = 'pending', payment_ref = ?, updated_at = datetime('now') WHERE id = ?",
        invoice.invoiceId,
        registrationId,
      );
    } catch (error) {
      console.error("QPay invoice creation failed", error);
      await run(
        "UPDATE registrations SET payment_method = 'bank_transfer', updated_at = datetime('now') WHERE id = ?",
        registrationId,
      );
    }
  }

  /*
    Both sent after the registration is committed and after any QPay attempt, so the
    confirmation reflects what actually happened — including the fall back to bank
    transfer when QPay fails.
  */
  const registrationUrl = `${siteUrl()}${localePath(locale, `/registration/${reference}`)}`;
  const amountLabel = amount > 0 ? formatMnt(amount, locale) : "";
  const eventTitle = tr(event, "title", locale);

  await Promise.all([
    notify(
      registrationConfirmationMessage(
        data.email,
        data.fullName,
        {
          reference,
          eventTitle,
          eventDates: formatDateRange(event.starts_on, event.ends_on, locale),
          amount: amountLabel,
          bankName: locale === "mn" ? settings.bank_name_mn : settings.bank_name_en,
          bankAccountNumber: settings.bank_account_number,
          bankAccountName: settings.bank_account_name,
          contactEmail: settings.contact_email,
          registrationUrl,
        },
        locale,
      ),
      "registration confirmation",
    ),
    settings.contact_email
      ? notify(
          newRegistrationNotice(
            settings.contact_email,
            data.fullName,
            data.email,
            tr(event, "title", "mn"),
            reference,
            amountLabel,
            `${siteUrl()}${localePath("mn", "/admin/registrations")}`,
          ),
          "new registration notice",
        )
      : Promise.resolve(),
  ]);

  redirect(localePath(locale, `/registration/${reference}`));
}

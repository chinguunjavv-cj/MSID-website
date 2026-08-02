"use client";

import { useActionState, useState } from "react";
import type { Locale } from "@/lib/db/types";
import type { FormState } from "@/lib/actions/types";
import { registerForEventAction } from "@/lib/actions/registration";
import { Field, SelectField, SubmitButton, TextareaField } from "@/components/ui/Form";
import { FormErrorSummary, Notice } from "@/components/ui/Primitives";

const INITIAL: FormState = { errors: [] };

export interface FeeOption {
  id: string;
  label: string;
  amount: number;
  formatted: string;
}

export function RegistrationForm({
  locale,
  slug,
  fees,
  qpayAvailable,
  isMember,
  defaults,
  labels,
  guard,
}: {
  locale: Locale;
  slug: string;
  fees: FeeOption[];
  qpayAvailable: boolean;
  isMember: boolean;
  defaults: { fullName: string; email: string; phone: string; institution: string; position: string };
  labels: Record<string, string>;
  /** Hidden spam-guard fields, minted on the server. */
  guard?: React.ReactNode;
}) {
  const [state, action] = useActionState(registerForEventAction, INITIAL);
  const [feeId, setFeeId] = useState(fees[0]?.id ?? "");

  const selected = fees.find((fee) => fee.id === feeId);
  const fieldError = (name: string) => state.fieldErrors?.[name];

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      {guard}
      <input type="hidden" name="slug" value={slug} />

      <FormErrorSummary title={labels.errorTitle} errors={state.errors} />

      {isMember && <Notice tone="active">{labels.memberDiscountHint}</Notice>}

      <fieldset className="space-y-5">
        <legend className="mb-4 text-label font-semibold text-ink-600">
          {labels.step1}
        </legend>

        <Field
          label={labels.fullName}
          name="fullName"
          required
          autoComplete="name"
          defaultValue={defaults.fullName}
          error={fieldError("fullName")}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label={labels.email}
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={defaults.email}
            error={fieldError("email")}
          />
          <Field
            label={labels.phone}
            name="phone"
            type="tel"
            autoComplete="tel"
            defaultValue={defaults.phone}
            optionalLabel={labels.optional}
            error={fieldError("phone")}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label={labels.institution}
            name="institution"
            autoComplete="organization"
            defaultValue={defaults.institution}
            optionalLabel={labels.optional}
            error={fieldError("institution")}
          />
          <Field
            label={labels.position}
            name="position"
            autoComplete="organization-title"
            defaultValue={defaults.position}
            optionalLabel={labels.optional}
            error={fieldError("position")}
          />
        </div>
        <Field
          label={labels.country}
          name="country"
          defaultValue={locale === "mn" ? "Монгол" : "Mongolia"}
          optionalLabel={labels.optional}
        />
      </fieldset>

      {fees.length > 0 && (
        <fieldset className="space-y-5 border-t border-ink-200 pt-6">
          <legend className="mb-4 text-label font-semibold text-ink-600">
            {labels.step2}
          </legend>

          <div>
            <label htmlFor="feeId" className="field-label">
              {labels.feeCategory}
            </label>
            <select
              id="feeId"
              name="feeId"
              value={feeId}
              onChange={(event) => setFeeId(event.target.value)}
              className="select"
              aria-invalid={fieldError("feeId") ? "true" : undefined}
            >
              {fees.map((fee) => (
                <option key={fee.id} value={fee.id}>
                  {fee.label} — {fee.formatted}
                </option>
              ))}
            </select>
            {fieldError("feeId") && <p className="field-error">{fieldError("feeId")}</p>}
          </div>

          {selected && (
            <p className="tabular border border-ink-200 bg-ink-50 px-4 py-3">
              <span className="text-ink-600">{labels.amountDue}: </span>
              <span className="text-lg font-bold text-ink-900">{selected.formatted}</span>
            </p>
          )}

          {qpayAvailable && selected && selected.amount > 0 && (
            <SelectField
              label={labels.paymentInstructions}
              name="paymentMethod"
              defaultValue="bank_transfer"
              options={[
                { value: "bank_transfer", label: labels.bankTransfer },
                { value: "qpay", label: labels.qpay },
              ]}
            />
          )}
        </fieldset>
      )}

      <fieldset className="space-y-5 border-t border-ink-200 pt-6">
        <legend className="mb-4 text-label font-semibold text-ink-600">
          {labels.additional}
        </legend>

        <Field
          label={labels.abstractTitle}
          name="abstractTitle"
          hint={labels.abstractHint}
          optionalLabel={labels.optional}
        />
        <TextareaField
          label={labels.notes}
          name="notes"
          rows={4}
          optionalLabel={labels.optional}
        />
      </fieldset>

      <SubmitButton label={labels.submit} pendingLabel={labels.submitting} />
    </form>
  );
}

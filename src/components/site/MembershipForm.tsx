"use client";

import { useActionState } from "react";
import type { Locale } from "@/lib/db/types";
import { applyForMembershipAction } from "@/lib/actions/auth";
import type { FormState } from "@/lib/actions/types";
import { Field, SelectField, SubmitButton } from "@/components/ui/Form";
import { FormErrorSummary } from "@/components/ui/Primitives";

const INITIAL: FormState = { errors: [] };

export function MembershipForm({
  locale,
  labels,
  membershipTypes,
  guard,
}: {
  locale: Locale;
  labels: Record<string, string>;
  membershipTypes: { value: string; label: string }[];
  /**
   * The spam guard's hidden fields. Passed in rather than imported: it mints a signed
   * token on the server, and this component runs on the client.
   */
  guard?: React.ReactNode;
}) {
  const [state, action] = useActionState(applyForMembershipAction, INITIAL);
  const fieldError = (name: string) => state.fieldErrors?.[name];

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      {guard}
      <FormErrorSummary title={labels.errorTitle} errors={state.errors} />

      <fieldset className="space-y-5">
        <legend className="mb-4 text-label font-semibold text-ink-600">
          {labels.personalSection}
        </legend>

        <Field
          label={labels.name}
          name="name"
          required
          autoComplete="name"
          error={fieldError("name")}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label={labels.email}
            name="email"
            type="email"
            required
            autoComplete="email"
            error={fieldError("email")}
          />
          <Field
            label={labels.phone}
            name="phone"
            type="tel"
            autoComplete="tel"
            optionalLabel={labels.optional}
            error={fieldError("phone")}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-5 border-t border-ink-200 pt-6">
        <legend className="mb-4 text-label font-semibold text-ink-600">
          {labels.professionalSection}
        </legend>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label={labels.degree}
            name="degree"
            optionalLabel={labels.optional}
            placeholder="MD, PhD…"
            error={fieldError("degree")}
          />
          <Field
            label={labels.specialty}
            name="specialty"
            optionalLabel={labels.optional}
            error={fieldError("specialty")}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label={labels.institution}
            name="institution"
            optionalLabel={labels.optional}
            autoComplete="organization"
            error={fieldError("institution")}
          />
          <Field
            label={labels.position}
            name="position"
            optionalLabel={labels.optional}
            autoComplete="organization-title"
            error={fieldError("position")}
          />
        </div>
        <SelectField
          label={labels.membershipType}
          name="membershipType"
          options={membershipTypes}
          defaultValue="full"
        />
      </fieldset>

      <fieldset className="space-y-5 border-t border-ink-200 pt-6">
        <legend className="mb-4 text-label font-semibold text-ink-600">
          {labels.accountSection}
        </legend>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label={labels.password}
            name="password"
            type="password"
            required
            autoComplete="new-password"
            hint={labels.passwordHint}
            error={fieldError("password")}
          />
          <Field
            label={labels.passwordConfirm}
            name="passwordConfirm"
            type="password"
            required
            autoComplete="new-password"
            error={fieldError("passwordConfirm")}
          />
        </div>
      </fieldset>

      <SubmitButton label={labels.submit} pendingLabel={labels.submitting} />
    </form>
  );
}

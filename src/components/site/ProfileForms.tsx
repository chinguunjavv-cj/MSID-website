"use client";

import { useActionState } from "react";
import type { Locale } from "@/lib/db/types";
import { changePasswordAction, updateProfileAction } from "@/lib/actions/auth";
import type { FormState } from "@/lib/actions/types";
import { Field, SubmitButton } from "@/components/ui/Form";
import { FormErrorSummary, Notice } from "@/components/ui/Primitives";

const INITIAL: FormState = { errors: [] };

export function ProfileForm({
  locale,
  defaults,
  labels,
}: {
  locale: Locale;
  defaults: {
    name: string;
    phone: string;
    degree: string;
    specialty: string;
    institution: string;
    position: string;
  };
  labels: Record<string, string>;
}) {
  const [state, action] = useActionState(updateProfileAction, INITIAL);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <FormErrorSummary title={labels.errorTitle} errors={state.errors} />
      {state.ok && <Notice tone="active">{labels.saved}</Notice>}

      <Field
        label={labels.name}
        name="name"
        required
        defaultValue={defaults.name}
        error={state.fieldErrors?.name}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={labels.phone} name="phone" type="tel" defaultValue={defaults.phone} optionalLabel={labels.optional} />
        <Field label={labels.degree} name="degree" defaultValue={defaults.degree} optionalLabel={labels.optional} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={labels.specialty} name="specialty" defaultValue={defaults.specialty} optionalLabel={labels.optional} />
        <Field label={labels.position} name="position" defaultValue={defaults.position} optionalLabel={labels.optional} />
      </div>
      <Field
        label={labels.institution}
        name="institution"
        defaultValue={defaults.institution}
        optionalLabel={labels.optional}
      />

      <SubmitButton label={labels.save} pendingLabel={labels.saving} />
    </form>
  );
}

export function PasswordForm({
  locale,
  labels,
}: {
  locale: Locale;
  labels: Record<string, string>;
}) {
  const [state, action] = useActionState(changePasswordAction, INITIAL);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <FormErrorSummary title={labels.errorTitle} errors={state.errors} />
      {state.ok && <Notice tone="active">{labels.saved}</Notice>}

      <Field
        label={labels.currentPassword}
        name="currentPassword"
        type="password"
        required
        autoComplete="current-password"
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={labels.password}
          name="password"
          type="password"
          required
          autoComplete="new-password"
          hint={labels.passwordHint}
        />
        <Field
          label={labels.passwordConfirm}
          name="passwordConfirm"
          type="password"
          required
          autoComplete="new-password"
        />
      </div>

      <SubmitButton
        label={labels.save}
        pendingLabel={labels.saving}
        className="btn btn-secondary"
      />
    </form>
  );
}

export function SignOutButton({
  locale,
  label,
  action,
  className = "btn btn-secondary",
}: {
  locale: Locale;
  label: string;
  action: (formData: FormData) => void | Promise<void>;
  className?: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="locale" value={locale} />
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}

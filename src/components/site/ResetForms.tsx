"use client";

import { useActionState } from "react";
import type { Locale } from "@/lib/db/types";
import {
  requestPasswordResetAction,
  resetPasswordAction,
} from "@/lib/actions/auth";
import type { FormState } from "@/lib/actions/types";
import { Field, SubmitButton } from "@/components/ui/Form";
import { FormErrorSummary, Notice } from "@/components/ui/Primitives";

const INITIAL: FormState = { errors: [] };

/** Step one: ask for a link. */
export function ForgotPasswordForm({
  locale,
  labels,
}: {
  locale: Locale;
  labels: Record<string, string>;
}) {
  const [state, action] = useActionState(requestPasswordResetAction, INITIAL);

  /*
    Once the request is in, the form is replaced rather than left filled in. Leaving it
    would invite a second submission, and every submission sends mail.
  */
  if (state.ok) return <Notice tone="active">{labels.sent}</Notice>;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <FormErrorSummary errors={state.errors} />

      <Field
        label={labels.email}
        name="email"
        type="email"
        required
        autoComplete="email"
        error={state.fieldErrors?.email}
      />

      <SubmitButton
        label={labels.submit}
        pendingLabel={labels.submitting}
        className="btn btn-primary w-full"
      />
    </form>
  );
}

/** Step two: choose the new password. */
export function ChoosePasswordForm({
  locale,
  token,
  labels,
}: {
  locale: Locale;
  token: string;
  labels: Record<string, string>;
}) {
  const [state, action] = useActionState(resetPasswordAction, INITIAL);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />
      <FormErrorSummary errors={state.errors} />

      <Field
        label={labels.password}
        name="password"
        type="password"
        required
        autoComplete="new-password"
        hint={labels.passwordHint}
        error={state.fieldErrors?.password}
      />
      <Field
        label={labels.passwordConfirm}
        name="passwordConfirm"
        type="password"
        required
        autoComplete="new-password"
        error={state.fieldErrors?.passwordConfirm}
      />

      <SubmitButton
        label={labels.submit}
        pendingLabel={labels.submitting}
        className="btn btn-primary w-full"
      />
    </form>
  );
}

"use client";

import { useActionState } from "react";
import type { Locale } from "@/lib/db/types";
import { signInAction } from "@/lib/actions/auth";
import type { FormState } from "@/lib/actions/types";
import { Field, SubmitButton } from "@/components/ui/Form";
import { FormErrorSummary } from "@/components/ui/Primitives";

const INITIAL: FormState = { errors: [] };

export function LoginForm({
  locale,
  labels,
}: {
  locale: Locale;
  labels: {
    email: string;
    password: string;
    submit: string;
    submitting: string;
  };
}) {
  const [state, action] = useActionState(signInAction, INITIAL);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      {/* Sign-in failures are account-level, never per-field, so no summary title. */}
      <FormErrorSummary errors={state.errors} />

      <Field
        label={labels.email}
        name="email"
        type="email"
        required
        autoComplete="email"
      />
      <Field
        label={labels.password}
        name="password"
        type="password"
        required
        autoComplete="current-password"
      />

      <SubmitButton
        label={labels.submit}
        pendingLabel={labels.submitting}
        className="btn btn-primary w-full"
      />
    </form>
  );
}

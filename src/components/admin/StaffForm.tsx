"use client";

import { useActionState } from "react";
import type { Locale } from "@/lib/db/types";
import type { FormState } from "@/lib/actions/types";
import { createStaffAction } from "@/lib/actions/admin";
import { Field, SelectField, SubmitButton } from "@/components/ui/Form";
import { FormErrorSummary, Notice } from "@/components/ui/Primitives";

const INITIAL: FormState = { errors: [] };

export function StaffForm({
  locale,
  labels,
  roles,
}: {
  locale: Locale;
  labels: Record<string, string>;
  roles: { value: string; label: string }[];
}) {
  const [state, action] = useActionState(createStaffAction, INITIAL);

  return (
    <form action={action} className="max-w-2xl space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <FormErrorSummary title={labels.errorTitle} errors={state.errors} />
      {state.ok && <Notice tone="active">{labels.created}</Notice>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={labels.name} name="name" required />
        <Field label={labels.email} name="email" type="email" required autoComplete="off" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={labels.password}
          name="password"
          type="password"
          required
          autoComplete="new-password"
          hint={labels.passwordHint}
        />
        <SelectField label={labels.role} name="role" options={roles} defaultValue="editor" />
      </div>

      <SubmitButton label={labels.create} pendingLabel={labels.saving} />
    </form>
  );
}

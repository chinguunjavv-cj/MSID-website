"use client";

import { useActionState } from "react";
import type { Locale } from "@/lib/db/types";
import type { FormState } from "@/lib/actions/types";
import { saveSettingsAction } from "@/lib/actions/admin";
import type { SiteSettings } from "@/lib/settings-defaults";
import { SubmitButton } from "@/components/ui/Form";
import { FormErrorSummary, Notice } from "@/components/ui/Primitives";

const INITIAL: FormState = { errors: [] };

interface SettingField {
  name: keyof SiteSettings;
  label: string;
  kind?: "text" | "textarea" | "checkbox" | "date";
  hint?: string;
  lang?: string;
}

export function SettingsForm({
  locale,
  settings,
  sections,
  labels,
}: {
  locale: Locale;
  settings: SiteSettings;
  sections: { title: string; hint?: string; fields: SettingField[] }[];
  labels: Record<string, string>;
}) {
  const [state, action] = useActionState(saveSettingsAction, INITIAL);

  return (
    <form action={action} className="max-w-4xl space-y-10">
      <input type="hidden" name="locale" value={locale} />
      <FormErrorSummary title={labels.errorTitle} errors={state.errors} />
      {state.ok && <Notice tone="active">{labels.saved}</Notice>}

      {sections.map((section) => (
        <fieldset key={section.title} className="border-t border-ink-200 pt-6">
          <legend className="mb-2 text-label font-semibold text-ink-600">
            {section.title}
          </legend>
          {section.hint && <p className="mb-5 max-w-[68ch] text-small text-ink-600">{section.hint}</p>}

          <div className="grid gap-5 md:grid-cols-2">
            {section.fields.map((field) => {
              const value = settings[field.name] ?? "";

              if (field.kind === "checkbox") {
                return (
                  <div key={field.name} className="flex items-start gap-3 md:col-span-2">
                    <input
                      id={field.name}
                      type="checkbox"
                      name={field.name}
                      value="1"
                      defaultChecked={value === "1"}
                      className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-copper-700"
                    />
                    <div>
                      <label htmlFor={field.name} className="cursor-pointer font-medium text-ink-900">
                        {field.label}
                      </label>
                      {field.hint && <p className="field-hint">{field.hint}</p>}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={field.name}
                  className={field.kind === "textarea" ? "md:col-span-2" : undefined}
                >
                  <label htmlFor={field.name} className="field-label">
                    {field.label}
                  </label>
                  {field.kind === "textarea" ? (
                    <textarea
                      id={field.name}
                      name={field.name}
                      defaultValue={value}
                      rows={3}
                      lang={field.lang}
                      className="textarea min-h-24"
                    />
                  ) : (
                    <input
                      id={field.name}
                      type={field.kind === "date" ? "date" : "text"}
                      name={field.name}
                      defaultValue={value}
                      lang={field.lang}
                      className="input"
                    />
                  )}
                  {field.hint && <p className="field-hint">{field.hint}</p>}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="border-t border-ink-200 pt-6">
        <SubmitButton label={labels.save} pendingLabel={labels.saving} />
      </div>
    </form>
  );
}

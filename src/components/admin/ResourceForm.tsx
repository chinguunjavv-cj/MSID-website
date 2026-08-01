"use client";

import { useActionState, useId, useState } from "react";
import type { Locale } from "@/lib/db/types";
import type { FormState } from "@/lib/actions/types";
import { saveResourceAction, deleteResourceAction } from "@/lib/actions/admin";
import { bi, type FieldDef, type ResourceDef } from "@/lib/admin/resources";
import { SubmitButton } from "@/components/ui/Form";
import { FormErrorSummary } from "@/components/ui/Primitives";

const INITIAL: FormState = { errors: [] };

/* -------------------------------------------------------------------------- */
/* Upload field                                                                */
/* -------------------------------------------------------------------------- */

function UploadField({
  name,
  label,
  defaultValue,
  accept,
  labels,
}: {
  name: string;
  label: string;
  defaultValue: string;
  accept: string;
  labels: Record<string, string>;
}) {
  const id = useId();
  const [path, setPath] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/upload", { method: "POST", body });
      const data = (await response.json()) as { path?: string; error?: string };
      if (!response.ok || !data.path) throw new Error(data.error ?? "Upload failed");
      setPath(data.path);
    } catch (uploadError) {
      setError((uploadError as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input type="hidden" name={name} value={path} />

      <div className="flex flex-wrap items-center gap-3">
        <input
          id={id}
          type="file"
          accept={accept}
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
          className="input cursor-pointer file:mr-3 file:cursor-pointer file:rounded-xs file:border-0 file:bg-ink-100 file:px-3 file:py-1.5 file:text-[0.8125rem] file:font-semibold file:text-ink-800"
        />
        {busy && <span className="text-small text-ink-600">{labels.uploading}</span>}
      </div>

      {path && (
        <p className="mt-2 flex flex-wrap items-center gap-3 text-small">
          <a
            href={path}
            target="_blank"
            rel="noreferrer noopener"
            className="text-copper-700 underline underline-offset-2"
          >
            {path.split("/").pop()}
          </a>
          <button
            type="button"
            onClick={() => setPath("")}
            className="cursor-pointer text-ink-600 underline underline-offset-2 hover:text-status-expired"
          >
            {labels.remove}
          </button>
        </p>
      )}

      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Bilingual pair                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Both languages are shown side by side rather than behind tabs, so a missing
 * translation is visible at a glance instead of one click away.
 */
function BilingualPair({
  field,
  locale,
  values,
  error,
}: {
  field: FieldDef;
  locale: Locale;
  values: Record<string, unknown>;
  error?: string;
}) {
  const label = bi(field.label, locale);
  const mnId = useId();
  const enId = useId();
  const mnValue = String(values[`${field.name}_mn`] ?? "");
  const enValue = String(values[`${field.name}_en`] ?? "");

  const shared = "input";
  const Control = field.kind === "textarea" ? "textarea" : "input";

  return (
    <div>
      <p className="field-label">
        {label}
        {field.required && <span className="ml-1 text-status-expired">*</span>}
      </p>

      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <label htmlFor={mnId} className="mb-1 block text-[0.75rem] font-semibold text-ink-600">
            Монгол
          </label>
          <Control
            id={mnId}
            name={`${field.name}_mn`}
            defaultValue={mnValue}
            required={field.required}
            placeholder={field.placeholder}
            aria-invalid={error ? "true" : undefined}
            rows={field.kind === "textarea" ? 7 : undefined}
            className={field.kind === "textarea" ? "textarea" : shared}
            lang="mn"
          />
        </div>
        <div>
          <label htmlFor={enId} className="mb-1 block text-[0.75rem] font-semibold text-ink-600">
            English
          </label>
          <Control
            id={enId}
            name={`${field.name}_en`}
            defaultValue={enValue}
            placeholder={field.placeholder}
            rows={field.kind === "textarea" ? 7 : undefined}
            className={field.kind === "textarea" ? "textarea" : shared}
            lang="en"
          />
        </div>
      </div>

      {field.hint && <p className="field-hint">{bi(field.hint, locale)}</p>}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Single field                                                                */
/* -------------------------------------------------------------------------- */

function SingleField({
  field,
  locale,
  values,
  relationOptions,
  labels,
  error,
}: {
  field: FieldDef;
  locale: Locale;
  values: Record<string, unknown>;
  relationOptions: Record<string, { value: string; label: string }[]>;
  labels: Record<string, string>;
  error?: string;
}) {
  const id = useId();
  const label = bi(field.label, locale);
  const raw = values[field.name];
  const value = raw === null || raw === undefined ? "" : String(raw);

  if (field.kind === "image" || field.kind === "file") {
    return (
      <UploadField
        name={field.name}
        label={label}
        defaultValue={value}
        accept={field.kind === "image" ? "image/*" : "application/pdf,image/*"}
        labels={labels}
      />
    );
  }

  if (field.kind === "checkbox") {
    return (
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          name={field.name}
          defaultChecked={value === "1"}
          className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-copper-700"
        />
        <div>
          <label htmlFor={id} className="cursor-pointer font-medium text-ink-900">
            {label}
          </label>
          {field.hint && <p className="field-hint">{bi(field.hint, locale)}</p>}
        </div>
      </div>
    );
  }

  if (field.kind === "select") {
    const options = field.optionsFrom
      ? [{ value: "", label: "—" }, ...(relationOptions[field.name] ?? [])]
      : (field.options ?? []).map((option) => ({
          value: option.value,
          label: bi(option.label, locale),
        }));

    return (
      <div>
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        <select id={id} name={field.name} defaultValue={value} className="select">
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {field.hint && <p className="field-hint">{bi(field.hint, locale)}</p>}
      </div>
    );
  }

  const inputType =
    field.kind === "date" ? "date" : field.kind === "number" ? "number" : "text";

  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
        {field.required && <span className="ml-1 text-status-expired">*</span>}
      </label>
      {field.kind === "textarea" ? (
        <textarea
          id={id}
          name={field.name}
          defaultValue={value}
          rows={6}
          className="textarea"
        />
      ) : (
        <input
          id={id}
          type={inputType}
          name={field.name}
          defaultValue={value}
          required={field.required}
          placeholder={field.placeholder}
          aria-invalid={error ? "true" : undefined}
          className="input"
        />
      )}
      {field.hint && <p className="field-hint">{bi(field.hint, locale)}</p>}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Form                                                                        */
/* -------------------------------------------------------------------------- */

export function ResourceForm({
  resource,
  locale,
  values,
  recordId,
  relationOptions = {},
  labels,
}: {
  resource: ResourceDef;
  locale: Locale;
  values: Record<string, unknown>;
  recordId?: string;
  relationOptions?: Record<string, { value: string; label: string }[]>;
  labels: Record<string, string>;
}) {
  const [state, action] = useActionState(saveResourceAction, INITIAL);

  // Preserve declaration order while grouping into sections.
  const sections: { title: string; fields: FieldDef[] }[] = [];
  for (const field of resource.fields) {
    const title = field.section ? bi(field.section, locale) : bi(resource.singular, locale);
    let section = sections.find((entry) => entry.title === title);
    if (!section) {
      section = { title, fields: [] };
      sections.push(section);
    }
    section.fields.push(field);
  }

  return (
    <>
      <form action={action} className="max-w-4xl space-y-10">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="__resource" value={resource.key} />
        {recordId && <input type="hidden" name="__id" value={recordId} />}

        <FormErrorSummary title={labels.errorTitle} errors={state.errors} />

        {sections.map((section) => (
          <fieldset key={section.title} className="border-t border-ink-200 pt-6">
            <legend className="mb-5 text-label font-semibold text-ink-600">
              {section.title}
            </legend>
            <div className="space-y-6">
              {section.fields.map((field) =>
                field.bilingual ? (
                  <BilingualPair
                    key={field.name}
                    field={field}
                    locale={locale}
                    values={values}
                    error={state.fieldErrors?.[`${field.name}_mn`]}
                  />
                ) : (
                  <SingleField
                    key={field.name}
                    field={field}
                    locale={locale}
                    values={values}
                    relationOptions={relationOptions}
                    labels={labels}
                    error={state.fieldErrors?.[field.name]}
                  />
                ),
              )}
            </div>
          </fieldset>
        ))}

        <div className="flex flex-wrap gap-3 border-t border-ink-200 pt-6">
          <SubmitButton label={labels.save} pendingLabel={labels.saving} />
        </div>
      </form>

      {recordId && !resource.fixed && (
        <DeleteForm
          resourceKey={resource.key}
          recordId={recordId}
          locale={locale}
          labels={labels}
        />
      )}
    </>
  );
}

/**
 * Destructive action confirms before running, and lives outside the main form so it
 * can never be triggered by pressing Enter in a text field.
 */
function DeleteForm({
  resourceKey,
  recordId,
  locale,
  labels,
}: {
  resourceKey: string;
  recordId: string;
  locale: Locale;
  labels: Record<string, string>;
}) {
  return (
    <form
      action={deleteResourceAction}
      className="mt-16 max-w-4xl border-t border-status-expired/25 pt-6"
      onSubmit={(event) => {
        if (!window.confirm(labels.confirmDelete)) event.preventDefault();
      }}
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="__resource" value={resourceKey} />
      <input type="hidden" name="__id" value={recordId} />
      <p className="text-small text-ink-600">{labels.deleteHint}</p>
      <button
        type="submit"
        className="btn mt-3 cursor-pointer border-status-expired/40 text-status-expired hover:bg-status-expired-bg"
      >
        {labels.delete}
      </button>
    </form>
  );
}

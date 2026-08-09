"use client";

import { useFormStatus } from "react-dom";
import { useId } from "react";

/**
 * Form primitives.
 *
 * Labels are always visible above the control (never placeholders-as-labels), errors
 * are stated in words beneath the field and wired with `aria-describedby`, and the
 * submit button reports its own pending state.
 */

interface FieldProps {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  defaultValue?: string;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  rows?: number;
  optionalLabel?: string;
}

export function Field({
  label,
  name,
  type = "text",
  required,
  hint,
  error,
  defaultValue,
  placeholder,
  autoComplete,
  disabled,
  optionalLabel,
}: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
        {!required && optionalLabel && (
          <span className="ml-1.5 font-normal text-ink-600">({optionalLabel})</span>
        )}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        disabled={disabled}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete={autoComplete}
        /*
          An address is not prose. Spellcheck underlines every email and password a
          member types, which on a form that already reports its own errors reads as a
          second, wrong error. Derived from `type` rather than passed at each call site,
          so no field can forget it.
        */
        spellCheck={type === "email" || type === "password" ? false : undefined}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={[hint ? hintId : null, error ? errorId : null]
          .filter(Boolean)
          .join(" ")
          .trim() || undefined}
        className="input"
      />
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextareaField({
  label,
  name,
  required,
  hint,
  error,
  defaultValue,
  rows = 5,
  optionalLabel,
}: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
        {!required && optionalLabel && (
          <span className="ml-1.5 font-normal text-ink-600">({optionalLabel})</span>
        )}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        required={required}
        defaultValue={defaultValue}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={[hint ? hintId : null, error ? errorId : null]
          .filter(Boolean)
          .join(" ")
          .trim() || undefined}
        className="textarea"
      />
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  label,
  name,
  options,
  required,
  hint,
  error,
  defaultValue,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  required?: boolean;
  hint?: string;
  error?: string;
  defaultValue?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <select
        id={id}
        name={name}
        required={required}
        defaultValue={defaultValue}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={[hint ? hintId : null, error ? errorId : null]
          .filter(Boolean)
          .join(" ")
          .trim() || undefined}
        className="select"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({
  label,
  pendingLabel,
  className = "btn btn-primary",
}: {
  label: string;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={className}>
      {pending && (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {pending ? (pendingLabel ?? label) : label}
    </button>
  );
}

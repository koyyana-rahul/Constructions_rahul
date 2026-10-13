import { forwardRef } from "react";

const BASE =
  "block w-full rounded-md border bg-white px-3 py-2 text-sm text-navy-900 placeholder:text-concrete-400 transition-colors duration-150 disabled:cursor-not-allowed disabled:bg-concrete-100 disabled:text-concrete-500";

const STATE = (invalid) =>
  invalid
    ? "border-danger-500 focus:border-danger-600 focus:ring-danger-500"
    : "border-concrete-300 hover:border-concrete-400 focus:border-navy-500 focus:ring-navy-400";

const controlClasses = (invalid) =>
  `${BASE} ${STATE(invalid)} focus:outline-none focus:ring-2`;

/**
 * Positions an icon inside the control itself.
 * The wrapper is `relative` and contains only the control, so `top-1/2`
 * centres on the input - not on the label/hint block that surrounds it.
 */
const Control = ({ icon, trailing, children }) => (
  <div className="relative">
    {icon && (
      <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-concrete-400">
        {icon}
      </span>
    )}
    {children}
    {trailing && (
      <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div>
    )}
  </div>
);

export const Input = forwardRef(function Input(
  { label, error, hint, id, className = "", invalid, required, icon, trailing, ...props },
  ref
) {
  const inputId = id || props.name;
  return (
    <Field id={inputId} label={label} error={error} hint={hint} required={required}>
      <Control icon={icon} trailing={trailing}>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={invalid || !!error || undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={`${controlClasses(invalid || error)} ${
            trailing ? "pr-11" : ""
          } ${icon ? "pl-9" : ""} ${className}`}
          {...props}
        />
      </Control>
    </Field>
  );
});

export const Textarea = forwardRef(function Textarea(
  { label, error, hint, id, className = "", invalid, required, rows = 4, ...props },
  ref
) {
  const inputId = id || props.name;
  return (
    <Field id={inputId} label={label} error={error} hint={hint} required={required}>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        aria-invalid={invalid || !!error || undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={`${controlClasses(invalid || error)} resize-y ${className}`}
        {...props}
      />
    </Field>
  );
});

export const Select = forwardRef(function Select(
  { label, error, hint, id, className = "", invalid, required, icon, children, ...props },
  ref
) {
  const inputId = id || props.name;
  return (
    <Field id={inputId} label={label} error={error} hint={hint} required={required}>
      <Control icon={icon}>
        <select
          ref={ref}
          id={inputId}
          aria-invalid={invalid || !!error || undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={`${controlClasses(invalid || error)} cursor-pointer pr-8 ${
            icon ? "pl-9" : ""
          } ${className}`}
          {...props}
        >
          {children}
        </select>
      </Control>
    </Field>
  );
});

export const Checkbox = forwardRef(function Checkbox(
  { label, error, id, className = "", ...props },
  ref
) {
  const inputId = id || props.name;
  return (
    <div className={className}>
      <label className="inline-flex cursor-pointer items-start gap-2">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-concrete-300 accent-navy-900 focus:ring-2 focus:ring-accent-500"
          {...props}
        />
        <span className="text-sm text-navy-800">{label}</span>
      </label>
      {error && (
        <p id={`${inputId}-error`} className="mt-1 text-xs text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
});

/** Shared label + control + error layout used by every form control above. */
export function Field({ id, label, error, hint, required, children }) {
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={id}
          className="mb-1.5 block font-display text-xs font-semibold uppercase tracking-wider text-navy-700"
        >
          {label}
          {required && (
            <span className="ml-0.5 text-danger-600" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-danger-600">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-concrete-500">{hint}</p>
      )}
    </div>
  );
}
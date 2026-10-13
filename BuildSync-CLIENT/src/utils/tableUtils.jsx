import Button from "../components/ui/Button";
import { StatusBadge } from "../components/ui/Badge";

/* ------------------------------------------------------------- Row actions */

/** Ghost icon-only action cluster keeps dense tables readable. */
export const RowActions = ({ children, label = "Row actions" }) => (
  <div className="flex items-center gap-1" role="group" aria-label={label}>
    {children}
  </div>
);

export const IconAction = ({ title, onClick, tone = "neutral", disabled, children }) => {
  const tones = {
    neutral: "text-navy-600 hover:bg-navy-50 hover:text-navy-900",
    danger: "text-danger-600 hover:bg-danger-50 hover:text-danger-700",
    accent: "text-accent-600 hover:bg-accent-50 hover:text-accent-700",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      // `disabled` was previously accepted by callers but never forwarded, so
      // a pending mutation could be fired repeatedly.
      disabled={disabled}
      aria-disabled={disabled || undefined}
      title={title}
      aria-label={title}
      className={`inline-flex h-8 w-8 items-center justify-center rounded transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${tones[tone]}`}
    >
      {children}
    </button>
  );
};

/* ---------------------------------------------------------------- Helpers */

/** Formats a date value, falling back to an em dash. */
export const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
};

export const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export { Button, StatusBadge };
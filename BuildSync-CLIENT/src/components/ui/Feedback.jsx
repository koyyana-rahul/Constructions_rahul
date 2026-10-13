import {
  LuLoader2,
  LuAlertTriangle,
  LuCheckCircle2,
  LuInfo,
  LuInbox,
  LuShieldAlert,
} from "react-icons/lu";
import { toneOf } from "../../lib/semantic";

/* ------------------------------------------------------------------ Spinner */

export const Spinner = ({ className = "h-5 w-5" }) => (
  <LuLoader2 className={`animate-spin text-navy-500 ${className}`} aria-hidden="true" />
);

/* -------------------------------------------------------------- Skeletons */

const shimmer =
  "relative overflow-hidden bg-concrete-200/70 after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-gradient-to-r after:from-transparent after:via-white/60 after:to-transparent";

export const Skeleton = ({ className = "" }) => <div className={`${shimmer} rounded ${className}`} />;

export const TableSkeleton = ({ rows = 6 }) => (
  <div className="divide-y divide-concrete-100" aria-hidden="true">
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="flex items-center gap-4 px-5 py-3.5">
        <Skeleton className="h-4 w-8" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    ))}
  </div>
);

// `className` lets each page mirror its own real grid so the layout does not
// jump when the data lands.
export const CardSkeleton = ({ count = 4, className = "" }) => (
  <div
    className={`grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 ${className}`}
    aria-hidden="true"
  >
    {Array.from({ length: count }).map((_, index) => (
      <div
        key={index}
        className="rounded-lg border border-concrete-200 bg-white p-4 shadow-card sm:p-5"
      >
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-20 sm:w-24" />
            <Skeleton className="h-6 w-12 sm:h-7 sm:w-16" />
            <Skeleton className="h-2.5 w-14 sm:w-20" />
          </div>
          <Skeleton className="h-9 w-9 shrink-0 rounded-md sm:h-10 sm:w-10" />
        </div>
      </div>
    ))}
  </div>
);

/** Full-page loading state with an accessible live region. */
export const PageLoader = ({ label = "Loading" }) => (
  <div
    role="status"
    aria-live="polite"
    className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-concrete-500"
  >
    <Spinner className="h-7 w-7" />
    <p className="font-display text-sm uppercase tracking-widest">{label}</p>
  </div>
);

/* ------------------------------------------------------------ Empty state */

export const EmptyState = ({ icon: Icon = LuInbox, title, description, action }) => (
  <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-concrete-100">
      <Icon className="h-6 w-6 text-concrete-400" aria-hidden="true" />
    </div>
    <div>
      <p className="font-display text-base font-semibold uppercase tracking-wide text-navy-800">
        {title}
      </p>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-sm text-concrete-500">{description}</p>
      )}
    </div>
    {action}
  </div>
);

/* ------------------------------------------------------------------ Alert */

// Built from the shared semantic tokens so an alert, a badge and a progress
// fill for the same state can never be given different shades.
const alertWrap = (semantic) => {
  const t = toneOf(semantic);
  return `${t.border} ${t.soft} ${t.text}`;
};

const ALERT_TONES = {
  error: { wrap: alertWrap("danger"), Icon: LuAlertTriangle },
  success: { wrap: alertWrap("success"), Icon: LuCheckCircle2 },
  info: { wrap: alertWrap("info"), Icon: LuInfo },
  warning: { wrap: alertWrap("warning"), Icon: LuAlertTriangle },
};

export const Alert = ({ variant = "error", children, onDismiss, className = "" }) => {
  if (!children) return null;
  const { wrap, Icon } = ALERT_TONES[variant] || ALERT_TONES.error;
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-md border px-3.5 py-3 text-sm ${wrap} ${className}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">{children}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-xs font-semibold uppercase tracking-wide opacity-70 hover:opacity-100"
        >
          Dismiss
        </button>
      )}
    </div>
  );
};

/* ------------------------------------------------------- Permission denied */

/**
 * Shown when the API returns 403. Access is decided by the server, so this
 * must not look like a transient failure or invite a retry.
 */
export const PermissionDenied = ({
  title = "You don't have access to this",
  description = "Your account does not have permission to view this information. Contact your administrator if you believe this is a mistake.",
  action,
}) => (
  <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
    <div className={`flex h-12 w-12 items-center justify-center rounded-full ${toneOf("warning").soft}`}>
      <LuShieldAlert className={`h-6 w-6 ${toneOf("warning").iconText}`} aria-hidden="true" />
    </div>
    <div>
      <p className="font-display text-base font-semibold uppercase tracking-wide text-navy-800">
        {title}
      </p>
      <p className="mx-auto mt-1 max-w-md text-sm text-concrete-500">{description}</p>
    </div>
    {action}
  </div>
);
import { toneOf } from "../../lib/semantic";

// Pill surface, dot and ring all resolve through the shared semantic tokens,
// so a badge, an alert and a progress fill can never drift apart.
const TONES = Object.fromEntries(
  Object.entries({
    neutral: "neutral",
    navy: "navy",
    accent: "accent",
    success: "success",
    warning: "warning",
    danger: "danger",
    info: "info",
  }).map(([key, semantic]) => {
    const t = toneOf(semantic);
    return [key, `${t.soft} ${t.text} ${t.ring}`];
  })
);

const DOT_TONES = Object.fromEntries(
  ["neutral", "navy", "accent", "success", "warning", "danger", "info"].map((semantic) => [
    semantic,
    toneOf(semantic).dot,
  ])
);

/**
 * Maps the application's status vocabulary onto visual tones so leave and
 * work-request states read consistently everywhere instead of as raw strings.
 */
const STATUS_TONES = {
  approved: "success",
  rejected: "danger",
  pending: "warning",
  applied: "warning",
  appliedfor: "warning",
  active: "success",
  inactive: "neutral",
  archived: "neutral",
  present: "success",
  absent: "danger",
  late: "warning",
  halfday: "warning",
  leave: "info",
  holiday: "accent",
  natural: "navy",
  legal: "accent",
  paid: "success",
  unpaid: "warning",
  // Work-request lifecycle - returned by the dashboard summary aggregation.
  underreview: "info",
  inprogress: "accent",
  completed: "success",
  cancelled: "neutral",
};

/**
 * Normalise a status for tone lookup by dropping everything that isn't
 * alphanumeric.
 *
 * This matters: the work-request statuses are multi-word ("Under Review",
 * "In Progress"), so a plain lowercase lookup produced "under review" and never
 * matched the `underreview` key. Those badges silently fell through to neutral
 * grey while the dashboard's coloured bar segment for the same status used
 * blue - the exact badge/indicator disagreement this token table exists to
 * prevent.
 */
const normalizeStatus = (status) =>
  String(status ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export const resolveTone = (status) => STATUS_TONES[normalizeStatus(status)] || "neutral";

const Badge = ({ children, tone = "neutral", dot = false, className = "" }) => (
  <span
    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 font-display text-xs font-semibold uppercase tracking-wide ring-1 ring-inset ${TONES[tone] || TONES.neutral} ${className}`}
  >
    {dot && (
      <span
        className={`h-1.5 w-1.5 rounded-full ${DOT_TONES[tone] || DOT_TONES.neutral}`}
        aria-hidden="true"
      />
    )}
    {children}
  </span>
);

/** Status-aware badge - pass the raw status string straight from the API. */
export const StatusBadge = ({ status, className = "" }) => (
  <Badge tone={resolveTone(status)} dot className={className}>
    {status || "Unknown"}
  </Badge>
);

export default Badge;
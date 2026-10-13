/**
 * Shared progress indicator for the whole app.
 *
 * Design rules this component enforces so every indicator matches:
 *  - one muted neutral track, one brand fill (never a gradient)
 *  - slim, consistent heights: sm 6px, md 8px, lg 10px
 *  - label left, value right, track immediately below, nothing floating
 *  - the fill animates with `transform: scaleX()` from the left origin, so a
 *    value change never reflows the surrounding layout
 *  - short ~300ms transition, and no animation at all under reduced motion
 *  - full ARIA progress semantics
 *
 * Three distinct states, because they mean different things:
 *
 *  1. determinate  - a real measured percentage (task completion, an approved
 *                    share of decided requests). `role="progressbar"` carries
 *                    aria-valuenow/min/max.
 *  2. indeterminate - a genuinely ongoing operation with no measurable
 *                    completion. `role="progressbar"` WITHOUT aria-valuenow,
 *                    which is the ARIA pattern for indeterminate progress.
 *  3. unavailable  - the backend has no progress field at all. Renders a muted
 *                    "no data" state instead of a fake 0%, because "0% done"
 *                    and "we don't know" are not the same claim.
 *
 * Categorical workflow states (Pending / Approved / Rejected) are NOT progress.
 * They use `StatusBadge`. Nothing here may invent a percentage for them.
 */

import { toneOf } from "../../lib/semantic";

/**
 * The fill resolves through the shared semantic tokens, so a progress bar that
 * measures "approved share" is drawn in the exact green as the APPROVED badge
 * beside it. `fill` is a deliberate data-mark shade; buttons use the heavier
 * `solid` shade for the same semantic (see lib/semantic.js).
 */
const fillFor = (semantic) => toneOf(semantic).fill;

/**
 * Business status -> tone. Supplied explicitly by the caller rather than
 * inferred from the percentage, so a 100% "rejected" bar can never render as a
 * success colour.
 */
const STATUS_TONES = {
  notStarted: "neutral",
  inProgress: "accent",
  completed: "success",
  failed: "danger",
  paused: "warning",
};

const SIZES = {
  sm: { track: "h-1.5", label: "text-[11px]", value: "text-xs" },
  md: { track: "h-2", label: "text-xs", value: "text-sm" },
  lg: { track: "h-2.5", label: "text-sm", value: "text-base" },
};

/** Returns null when the value cannot be trusted as a percentage. */
const toPercent = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.min(100, Math.max(0, number));
};

const ProgressBar = ({
  value,
  label,
  caption,
  tone = "navy",
  status,
  size = "md",
  showValue,
  showPercentage,
  indeterminate = false,
  unavailableText = "No data",
  ariaLabel,
  valueSuffix = "%",
  className = "",
}) => {
  const dimensions = SIZES[size] || SIZES.md;
  const resolvedTone = STATUS_TONES[status] || tone;
  const fill = fillFor(resolvedTone);
  const showReadout = showPercentage ?? showValue ?? false;

  const percent = indeterminate ? null : toPercent(value);
  const unavailable = !indeterminate && percent === null;
  const rounded = unavailable ? null : Math.round(percent);

  const readout = indeterminate ? null : unavailable ? unavailableText : `${rounded}${valueSuffix}`;

  return (
    <div className={className}>
      {(label || showReadout) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-x-3">
          {label && (
            <span className="min-w-0 break-words leading-snug">
              <span className={`font-medium text-concrete-600 ${dimensions.label}`}>
                {label}
              </span>
              {/* Supplementary counts, only when the caller has real ones. */}
              {caption && (
                <span className={`ml-1.5 text-concrete-400 ${dimensions.label}`}>{caption}</span>
              )}
            </span>
          )}
          {showReadout && (
            <span
              className={`shrink-0 font-display font-semibold tabular-nums leading-none ${
                unavailable ? "text-concrete-400" : "text-navy-900"
              } ${dimensions.value}`}
            >
              {readout}
            </span>
          )}
        </div>
      )}

      <div
        role="progressbar"
        // Indeterminate omits aria-valuenow entirely - that is how a screen
        // reader distinguishes "working, unknown extent" from "0% done".
        {...(indeterminate || unavailable
          ? {}
          : {
              "aria-valuenow": rounded,
              "aria-valuemin": 0,
              "aria-valuemax": 100,
            })}
        aria-valuetext={indeterminate ? "In progress" : readout || undefined}
        aria-busy={indeterminate || undefined}
        aria-label={ariaLabel || label || "Progress"}
        className={`w-full overflow-hidden rounded-full bg-concrete-200 ${dimensions.track}`}
      >
        {indeterminate ? (
          <div
            className={`h-full w-1/3 animate-progress-sweep rounded-full ${fill} motion-reduce:animate-none motion-reduce:w-full motion-reduce:opacity-40`}
          />
        ) : (
          <div
            className={`h-full w-full origin-left rounded-full transition-transform duration-300 ease-out-expo motion-reduce:transition-none ${
              unavailable ? "bg-concrete-300" : fill
            }`}
            style={{ transform: `scaleX(${(percent ?? 0) / 100})` }}
          />
        )}
      </div>
    </div>
  );
};

export default ProgressBar;
/**
 * Semantic colour tokens - the single source of truth for Builtra.
 *
 * Root cause this file exists to fix: every component used to carry its own
 * private colour map (Button.VARIANTS, Badge.TONES, Badge.DOT_TONES,
 * Alert.ALERT_TONES, ProgressBar.FILL_TONES, StatusBreakdown.SEGMENT_TONES),
 * so the same meaning was expressed at different shades in different places -
 * `completed` was success-600 in the dashboard bar while `approved` was
 * success-500, and `cancelled` was concrete-300 while the neutral badge dot was
 * concrete-400. A progress bar could therefore disagree with the badge sitting
 * next to it.
 *
 * Every component now resolves its colour through `TONE[semantic]`, so a state
 * looks identical everywhere it appears.
 *
 * Roles, and why the shades differ:
 *  - `solid` / `solidHover` / `solidActive` - filled action buttons. Heavier,
 *    because a button is a large click target that needs presence.
 *  - `fill`  - progress-bar fill and meters. Readable against the muted track.
 *  - `dot`   - badge status dot and stacked distribution segments. The
 *              lightest mark, because it sits inside an already-coloured pill.
 *  - `soft` / `text` / `ring` - badge and alert surfaces.
 *
 * APPLICATION CONVENTION (do not "fix" this in isolation):
 * Builtra uses construction orange (accent) for ACTIONS and semantic colour
 * for STATES. "Approve request" is deliberately an accent button, because it is
 * something the admin does; the resulting APPROVED badge is success green,
 * because that is where the record now stands. Orange is therefore not a bug to
 * be recoloured - progress that measures a state uses the state colour, and
 * progress that measures an action's outcome stays tied to that state's badge.
 */

export const TONE = {
  navy: {
    solid: "bg-navy-900",
    solidHover: "bg-navy-800",
    solidActive: "bg-navy-950",
    fill: "bg-navy-600",
    dot: "bg-navy-500",
    soft: "bg-navy-50",
    text: "text-navy-700",
    iconText: "text-navy-700",
    ring: "ring-navy-200",
    border: "border-navy-500/30",
    value: "text-navy-900",
  },
  accent: {
    solid: "bg-accent-600",
    solidHover: "bg-accent-700",
    solidActive: "bg-accent-800",
    fill: "bg-accent-500",
    dot: "bg-accent-500",
    soft: "bg-accent-50",
    text: "text-accent-700",
    iconText: "text-accent-600",
    ring: "ring-accent-200",
    border: "border-accent-500/30",
    value: "text-accent-600",
  },
  success: {
    solid: "bg-success-600",
    solidHover: "bg-success-700",
    solidActive: "bg-success-700",
    fill: "bg-success-500",
    dot: "bg-success-500",
    soft: "bg-success-50",
    text: "text-success-700",
    iconText: "text-success-600",
    ring: "ring-success-500/30",
    border: "border-success-500/30",
    value: "text-success-700",
  },
  warning: {
    solid: "bg-warning-600",
    solidHover: "bg-warning-700",
    solidActive: "bg-warning-700",
    fill: "bg-warning-500",
    dot: "bg-warning-500",
    soft: "bg-warning-50",
    text: "text-warning-700",
    iconText: "text-warning-600",
    ring: "ring-warning-500/30",
    border: "border-warning-500/30",
    value: "text-warning-700",
  },
  danger: {
    solid: "bg-danger-600",
    solidHover: "bg-danger-700",
    solidActive: "bg-danger-700",
    fill: "bg-danger-500",
    dot: "bg-danger-500",
    soft: "bg-danger-50",
    text: "text-danger-700",
    iconText: "text-danger-600",
    ring: "ring-danger-500/30",
    border: "border-danger-500/30",
    value: "text-danger-700",
  },
  info: {
    solid: "bg-info-600",
    solidHover: "bg-info-700",
    solidActive: "bg-info-700",
    fill: "bg-info-500",
    dot: "bg-info-500",
    soft: "bg-info-50",
    text: "text-info-700",
    iconText: "text-info-600",
    ring: "ring-info-500/30",
    border: "border-info-500/30",
    value: "text-info-700",
  },
  neutral: {
    solid: "bg-concrete-100",
    solidHover: "bg-concrete-200",
    solidActive: "bg-concrete-300",
    fill: "bg-concrete-400",
    dot: "bg-concrete-400",
    soft: "bg-concrete-100",
    text: "text-concrete-700",
    iconText: "text-concrete-600",
    ring: "ring-concrete-300",
    border: "border-concrete-300",
    value: "text-navy-900",
  },
};

export const toneOf = (semantic) => TONE[semantic] || TONE.neutral;

/** Bare Tailwind colour name for a semantic, e.g. "success" -> "success-500". */
export const colorName = (semantic, role = "fill") => {
  const cls = toneOf(semantic)[role] || toneOf(semantic).fill;
  return (cls.match(/^[a-z]+-([a-z]+-\d+)/) || [])[1] || "concrete-400";
};
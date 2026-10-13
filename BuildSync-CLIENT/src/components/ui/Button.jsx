import { LuLoader2 } from "react-icons/lu";
import { toneOf } from "../../lib/semantic";

/** Filled action button for a semantic, built from the shared `solid` shades. */
const solidButton = (semantic) => {
  const t = toneOf(semantic);
  return `${t.solid} text-white hover:${t.solidHover} active:${t.solidActive} shadow-card disabled:bg-concrete-300`;
};

const NEUTRAL = toneOf("neutral");
const DANGER = toneOf("danger");

// Filled actions use the shared `solid` shades, so a button and a progress bar
// expressing the same state resolve to one semantic colour rather than two
// independently chosen ones.
const VARIANTS = {
  primary: solidButton("navy"),
  accent: solidButton("accent"),
  secondary: `${NEUTRAL.solid} text-navy-800 hover:${NEUTRAL.solidHover} active:${NEUTRAL.solidActive} disabled:text-concrete-400`,
  outline:
    "border border-concrete-300 bg-white text-navy-800 hover:border-navy-400 hover:bg-navy-50 active:bg-navy-100 disabled:text-concrete-400",
  ghost: `text-navy-700 hover:${NEUTRAL.solid} active:${NEUTRAL.solidHover} disabled:text-concrete-400`,
  danger: solidButton("danger"),
  "danger-outline": `border border-danger-500 bg-white ${DANGER.text} hover:${DANGER.soft} active:bg-danger-100 disabled:text-concrete-400`,
};

const SIZES = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
  icon: "h-9 w-9 justify-center",
};

const Button = ({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className = "",
  type = "button",
  ...props
}) => (
  <button
    type={type}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    className={`inline-flex shrink-0 items-center justify-center rounded-md font-display font-semibold uppercase tracking-wide transition-all duration-150 ease-out-expo disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    {...props}
  >
    {loading && <LuLoader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
    {children}
  </button>
);

export default Button;
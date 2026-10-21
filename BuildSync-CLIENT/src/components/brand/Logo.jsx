import { APP_NAME, WORDMARK_LEAD, WORDMARK_ACCENT } from "../../lib/brand";

/**
 * The Builtra logo.
 *
 * ── The concept ─────────────────────────────────────────────────────────────
 * A block-built letter "B" drawn like an architectural elevation: two
 * structural bays (the bowls) sitting on a solid spine (the stem). Because
 * the bays are drawn as OUTLINES, the mark reads like a blueprint drawing
 * rather than a filled glyph, and it stays legible down to 16px where a
 * filled glyph turns to mush.
 *
 * It is an SVG component rather than a PNG or SVG file so that:
 *   - it inherits `currentColor` and works on navy, white and slate;
 *   - it stays crisp on every screen density, including 2x mobile;
 *   - it needs no build step and no image optimisation plugin.
 *
 * The static `public/favicon.svg` and `public/icon.svg` are hand-matched
 * copies of the same geometry for the places a React component cannot go
 * (browser tab, installed app icon, PWA manifest).
 */

/**
 * The symbol on its own.
 * @param variant "solid"  - filled strokes, for light backgrounds
 *                 "light"  - currentColor strokes, for dark backgrounds
 */
export const BrandSymbol = ({ className = "h-5 w-5", variant = "solid", ...props }) => {
  // In the solid variant the bays are filled shapes (no stroke), which keeps
  // the mark crisp when it is rendered small or on a busy background.
  if (variant === "solid") {
    return (
      <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" className={className} {...props}>
        {/* upper bay */}
        <path d="M11 4h13a6 6 0 0 1 0 12H11z" />
        {/* lower bay */}
        <path d="M11 16h14a6 6 0 0 1 0 12H11z" />
        {/* spine */}
        <rect x="4" y="4" width="7" height="24" rx="2.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className} {...props}>
      <rect x="8" y="4" width="19" height="11" rx="5.5" stroke="currentColor" strokeWidth="4" />
      <rect x="8" y="17" width="19" height="11" rx="5.5" stroke="currentColor" strokeWidth="4" />
      <rect x="5" y="4" width="6" height="24" rx="3" fill="currentColor" />
    </svg>
  );
};

/**
 * The symbol inside its brand tile.
 *
 * The tile is the orange rounded square that appears in the sidebar, the
 * auth panel and the assistant header - it is the one piece of chrome that
 * appears at every size, so it carries the accent consistently.
 */
export const BrandMark = ({ className = "h-9 w-9", tileClassName = "bg-accent-600", ...props }) => (
  <span
    className={`flex ${className} shrink-0 items-center justify-center rounded-md ${tileClassName}`}
  >
    <BrandSymbol className="h-[60%] w-[60%] text-white" variant="solid" {...props} />
  </span>
);

/**
 * The two-tone wordmark: "Built" in the lead colour, "ra" in the accent.
 *
 * The colour is chosen by an explicit `variant`, never inherited. The first
 * version relied on the surrounding text colour, and because `body` sets
 * `text-navy-900` the wordmark became navy-on-navy and disappeared into the
 * sidebar. A logo must not be able to inherit an invisible colour, so the
 * two supported contexts are named here:
 *
 *   onDark  - for the navy sidebar, the auth panel and the assistant header
 *   onLight - for white and light-grey surfaces
 */
const WORDMARK_VARIANTS = {
  onDark: { lead: "text-white", accent: "text-accent-400" },
  onLight: { lead: "text-navy-900", accent: "text-accent-600" },
};

export const BrandWordmark = ({
  className = "",
  variant = "onDark",
  accentClassName,
}) => {
  const tone = WORDMARK_VARIANTS[variant] || WORDMARK_VARIANTS.onDark;

  return (
    <span
      className={`font-display font-semibold uppercase leading-none tracking-wider ${tone.lead} ${className}`}
    >
      {WORDMARK_LEAD}
      <span className={accentClassName || tone.accent}>{WORDMARK_ACCENT}</span>
    </span>
  );
};

/**
 * The full horizontal lockup: symbol + wordmark.
 * Used in the sidebar and the authentication panel.
 */
export const BrandLogo = ({
  className = "",
  markClassName = "h-9 w-9",
  wordClassName = "text-lg",
  variant = "onDark",
  accentClassName,
  showSubtitle = false,
  subtitle = "Construction Ops",
  subtitleClassName = "text-navy-300",
}) => (
  <span className={`flex min-w-0 items-center gap-3 ${className}`}>
    <BrandMark className={markClassName} />
    <span className="min-w-0">
      <BrandWordmark
        className={wordClassName}
        variant={variant}
        accentClassName={accentClassName}
      />
      {showSubtitle && (
        <span
          className={`mt-0.5 block truncate font-display text-2xs uppercase tracking-[0.18em] ${subtitleClassName}`}
        >
          {subtitle}
        </span>
      )}
    </span>
  </span>
);

/**
 * Accessible name for the logo when it is the only thing identifying the
 * product (e.g. a collapsed sidebar or a tab icon).
 */
export const brandLabel = `${APP_NAME} — Construction Operations`;

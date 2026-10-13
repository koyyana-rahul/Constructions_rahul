import { Card } from "./Card";
import { toneOf } from "../../lib/semantic";

// Icon chips and metric values resolve through the shared semantic tokens, so a
// KPI tile cannot end up a different shade from the badge or progress bar for
// the same state.
const SEMANTICS = ["navy", "accent", "success", "warning", "danger", "info", "neutral"];

const ICON_TONES = Object.fromEntries(
  SEMANTICS.map((semantic) => [semantic, `${toneOf(semantic).soft} ${toneOf(semantic).iconText}`])
);

const VALUE_TONES = Object.fromEntries(
  SEMANTICS.map((semantic) => [semantic, toneOf(semantic).value])
);

/**
 * Dashboard KPI tile. Replaces the old colour-block SummaryCard, which used
 * fully saturated backgrounds for the icon and read as generic admin-template.
 *
 * Mobile-first: these sit in a two-column grid from 320px up, so the icon, gap
 * and padding all step down below `sm` to keep roughly 78px of usable width for
 * the label instead of collapsing it to a sliver.
 */
const StatCard = ({ icon: Icon, label, value, tone = "navy", hint, className = "" }) => (
  <Card className={`group p-4 transition-shadow duration-200 hover:shadow-card-hover sm:p-5 ${className}`}>
    <div className="flex items-start gap-3 sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="font-display text-[11px] font-semibold uppercase leading-tight tracking-wider text-concrete-500 break-words sm:text-xs">
          {label}
        </p>
        <p
          className={`mt-1.5 font-display text-2xl font-semibold tabular-nums leading-none break-words sm:text-3xl ${
            VALUE_TONES[tone] || VALUE_TONES.navy
          }`}
        >
          {value ?? "—"}
        </p>
        {hint && (
          <p className="mt-1.5 text-[11px] leading-snug text-concrete-500 break-words sm:text-xs">
            {hint}
          </p>
        )}
      </div>
      {Icon && (
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-transform duration-200 ease-out-expo group-hover:scale-105 sm:h-11 sm:w-11 ${
            ICON_TONES[tone] || ICON_TONES.navy
          }`}
        >
          <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" aria-hidden="true" />
        </span>
      )}
    </div>
  </Card>
);

export default StatCard;
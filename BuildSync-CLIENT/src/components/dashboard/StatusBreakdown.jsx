import { StatusBadge } from "../ui/Badge";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { Link } from "react-router-dom";
import { LuArrowRight } from "react-icons/lu";
import { toneOf } from "../../lib/semantic";

/**
 * Bar colours mirror `STATUS_TONES` in Badge.jsx so the segmented bar and the
 * legend below it always read as the same vocabulary. The bar itself is
 * decorative and hidden from assistive tech - the legend carries the values.
 */
/**
 * Each stage resolves through the shared semantic tokens, so a segment is
 * exactly the colour of the `StatusBadge` on the same card.
 *
 * `completed` used to be success-600 while `approved` was success-500, and
 * `cancelled` concrete-300 while the neutral badge dot was concrete-400 - the
 * two "finished" greens were visibly different. Using the shared `dot` shade
 * removes that drift.
 */
const STAGE_TONES = {
  pending: "warning",
  underReview: "info",
  applied: "warning",
  approved: "success",
  inProgress: "accent",
  completed: "success",
  rejected: "danger",
  cancelled: "neutral",
};

const SEGMENT_TONES = Object.fromEntries(
  Object.entries(STAGE_TONES).map(([stage, semantic]) => [stage, toneOf(semantic).dot])
);

/**
 * Status distribution for one request type.
 *
 * Replaces the old four-tile grid plus a single "approval rate" bar: the
 * segmented bar shows the real shape of the queue at a glance, and the legend
 * carries every count including the stages the tiles omitted.
 *
 * `stages` is an ordered array of `{ key, label }` - order drives both the bar
 * segments and the legend, so they can never drift apart.
 */
const StatusBreakdown = ({
  title,
  description,
  stages,
  counts,
  viewAllTo,
  viewAllLabel = "View all",
}) => {
  const rows = stages.map((stage) => ({
    ...stage,
    value: Number(counts?.[stage.key]) || 0,
  }));

  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const present = rows.filter((row) => row.value > 0);
  const decided = rows
    .filter((row) => row.key !== "pending" && row.key !== "underReview")
    .reduce((sum, row) => sum + row.value, 0);
  const approved = Number(counts?.approved) || 0;

  return (
    <Card className="flex flex-col">
      <CardHeader
        title={title}
        description={description}
        actions={
          <Link
            to={viewAllTo}
            className="inline-flex shrink-0 items-center gap-1 rounded font-display text-xs font-semibold uppercase tracking-wide text-accent-600 transition-colors hover:text-accent-700 focus-visible:ring-2 focus-visible:ring-accent-500"
          >
            {viewAllLabel}
            <LuArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        }
      />

      <CardBody className="flex flex-1 flex-col gap-4">
        {total === 0 ? (
          <p className="py-2 text-sm text-concrete-500">No requests recorded yet.</p>
        ) : (
          <>
            {/* Segmented distribution bar */}
            <div
              className="flex h-2 w-full overflow-hidden rounded-full bg-concrete-200"
              aria-hidden="true"
            >
              {present.map((row) => (
                <div
                  key={row.key}
                  className={`h-full first:rounded-l-full last:rounded-r-full ${
                    SEGMENT_TONES[row.key] || "bg-concrete-400"
                  }`}
                  style={{ width: `${(row.value / total) * 100}%` }}
                />
              ))}
            </div>

            {/* Legend - every count is text, never colour alone.
                The label sits directly above its number inside one compact
                tile. An earlier `justify-between` row pushed the badge and the
                count to opposite edges of a wide grid cell, which made it hard
                to tell which number belonged to which status. */}
            <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2">
              {rows.map((row) => (
                <li key={row.key} className="min-w-0 rounded-md bg-concrete-50 px-3 py-2.5">
                  <StatusBadge status={row.label} className="max-w-full" />
                  <p className="mt-1.5 font-display text-xl font-semibold tabular-nums leading-none text-navy-900">
                    {row.value}
                  </p>
                </li>
              ))}
            </ul>

            {decided > 0 && (
              <p className="mt-auto border-t border-concrete-100 pt-3 text-xs text-concrete-500">
                <span className="font-display font-semibold tabular-nums text-navy-800">
                  {Math.round((approved / decided) * 100)}%
                </span>{" "}
                of decided requests approved
              </p>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
};

export default StatusBreakdown;
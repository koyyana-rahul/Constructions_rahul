import DataTable from "react-data-table-component";
import { LuInbox } from "react-icons/lu";
import { EmptyState, TableSkeleton } from "./Feedback";

/**
 * One table system for the whole app.
 *
 * Desktop -> `react-data-table-component`, themed via `.bs-table`.
 * Mobile  -> a stacked card list, because squeezing 8 columns into 390px
 *            produces collisions and unreadable text.
 *
 * The `mobileCard` renderer receives the same row objects the table columns
 * use, so each page controls its own mobile content while sharing the
 * loading/empty/scroll behaviour.
 */
const ResponsiveList = ({
  columns,
  data,
  mobileCard,
  loading,
  skeletonRows = 6,
  emptyTitle,
  emptyDescription,
  emptyAction,
  emptyIcon = LuInbox,
  searchActive = false,
  onRetry,
  error,
  paginationPerPage = 10,
  rowKey = (row) => row._id ?? row.sno,
}) => {
  if (loading) return <TableSkeleton rows={skeletonRows} />;

  if (error && (!data || data.length === 0)) {
    return (
      <EmptyState
        icon={LuInbox}
        title="Could not load this list"
        description={error}
        action={
          onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-md border border-concrete-300 bg-white px-4 py-2 font-display text-xs font-semibold uppercase tracking-wide text-navy-800 transition-colors hover:border-navy-400 hover:bg-navy-50"
            >
              Try again
            </button>
          )
        }
      />
    );
  }

  const rows = data ?? [];

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle ?? (searchActive ? "No matches" : "Nothing here yet")}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <>
      {/* Mobile: stacked cards */}
      <div className="divide-y divide-concrete-100 lg:hidden">
        <ul className="flex flex-col">
          {rows.map((row, index) => (
            <li key={rowKey(row) ?? index} className="px-4 py-3.5">
              {mobileCard(row, index)}
            </li>
          ))}
        </ul>
      </div>

      {/* Desktop / tablet: full table */}
      <div className="bs-table hidden lg:block">
        <DataTable
          columns={columns}
          data={rows}
          pagination
          paginationPerPage={paginationPerPage}
          paginationRowsPerPageOptions={[paginationPerPage, 25, 50]}
          responsive
        />
      </div>
    </>
  );
};

/**
 * Row shell used by every mobile card.
 * `min-w-0` on the text column is what prevents long values from pushing the
 * action cluster out of the card - the actual cause of most collisions.
 */
export const MobileCard = ({ title, subtitle, meta, status, actions, children }) => (
  <div className="flex items-start gap-3">
    <div className="min-w-0 flex-1 space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="min-w-0 font-display text-sm font-semibold leading-snug text-navy-900 break-words">
          {title}
        </p>
        {status}
      </div>
      {subtitle && (
        <p className="break-words text-xs leading-relaxed text-concrete-500">{subtitle}</p>
      )}
      {children}
      {meta && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-concrete-500">
          {meta}
        </div>
      )}
    </div>
    {actions && <div className="flex shrink-0 items-center gap-0.5">{actions}</div>}
  </div>
);

export default ResponsiveList;
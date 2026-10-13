import { useId } from "react";
import { LuSearch, LuX } from "react-icons/lu";

/**
 * Search + filter chips + actions toolbar used above every data table.
 * Replaces the four different ad-hoc filter button styles in the app.
 */
const Toolbar = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search",
  searchLabel = "Search",
  children,
  actions,
  className = "",
}) => {
  const searchId = useId();

  return (
    <div
      className={`flex flex-col gap-3 border-b border-concrete-200 px-5 py-3.5 lg:flex-row lg:items-center lg:justify-between ${className}`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <LuSearch
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-concrete-400"
            aria-hidden="true"
          />
          <input
            id={searchId}
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchLabel}
            className="w-full rounded-md border border-concrete-300 bg-white py-2 pl-9 pr-8 text-sm text-navy-900 placeholder:text-concrete-400 transition-colors hover:border-concrete-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-400"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-concrete-400 transition-colors hover:bg-concrete-100 hover:text-navy-700"
            >
              <LuX className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
};

/** Segmented status filter, e.g. Pending / Approved / Rejected. */
export const FilterChips = ({ options, value, onChange, ariaLabel = "Filter by status" }) => (
  <div
    role="group"
    aria-label={ariaLabel}
    className="flex flex-wrap items-center gap-1.5 rounded-md bg-concrete-100 p-1"
  >
    {options.map((option) => {
      const isActive =
        value === option.value ||
        String(value).toLowerCase() === String(option.value).toLowerCase();
      return (
        <button
          key={option.value ?? "all"}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={isActive}
          className={`rounded px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-wide transition-colors duration-150 ${
            isActive
              ? "bg-navy-900 text-white shadow-card"
              : "text-concrete-600 hover:bg-white hover:text-navy-800"
          }`}
        >
          {option.label}
          {typeof option.count === "number" && (
            <span className={`ml-1.5 ${isActive ? "text-accent-300" : "text-concrete-400"}`}>
              {option.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

export default Toolbar;
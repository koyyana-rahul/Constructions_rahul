import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuArrowRight, LuLoader2, LuSearch, LuX } from "react-icons/lu";
import { getErrorMessage } from "../../lib/api";
import { useGetSearchSuggestionsQuery } from "../../services/api/endpoints/platformApi";

const TYPE_LABELS = {
  project: "Project",
  task: "Task",
  invoice: "Invoice",
  employee: "Employee",
  client: "Client",
  material: "Material",
  equipment: "Equipment",
  document: "Document",
  safety: "Safety",
};

/**
 * Type-ahead search for the top bar.
 *
 * Suggestions are already role-scoped by the server: a client can never receive
 * an employee or vendor result, and an employee only sees their own tasks.
 */
const GlobalSearch = () => {
  const navigate = useNavigate();
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 250);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // The "/" shortcut is global, not only while the panel is open.
  useEffect(() => {
    const onShortcut = (event) => {
      const tag = document.activeElement?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable;
      if (event.key === "/" && !typing) {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onShortcut);
    return () => document.removeEventListener("keydown", onShortcut);
  }, []);

  const { data: suggestions = [], isFetching, error } = useGetSearchSuggestionsQuery(
    { q: debounced },
    { skip: debounced.length < 2 }
  );

  const go = (link) => {
    if (!link || !String(link).startsWith("/")) return;
    setOpen(false);
    setTerm("");
    navigate(link);
  };

  const onSubmit = (event) => {
    event.preventDefault();
    if (suggestions.length === 1) go(suggestions[0].link);
  };

  const showPanel = open && debounced.length >= 2;

  return (
    <div ref={wrapperRef} className="relative min-w-0 flex-1 lg:max-w-sm lg:flex-none">
      <form onSubmit={onSubmit} role="search">
        <LuSearch
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-concrete-400"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="search"
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search projects, tasks, invoices…"
          aria-label="Search the workspace"
          aria-expanded={showPanel}
          className="w-full rounded-md border border-concrete-200 bg-concrete-50 py-2 pl-9 pr-8 text-sm text-navy-900 placeholder:text-concrete-400 transition-colors hover:border-concrete-300 focus:border-navy-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-300"
        />
        {term ? (
          <button
            type="button"
            onClick={() => {
              setTerm("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-concrete-400 hover:bg-concrete-100 hover:text-navy-700"
          >
            <LuX className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-concrete-200 bg-white px-1.5 py-0.5 font-mono text-2xs text-concrete-400 sm:block">
            /
          </kbd>
        )}
      </form>

      {showPanel && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-concrete-200 bg-white shadow-popover">
          {isFetching && suggestions.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-4 text-sm text-concrete-500">
              <LuLoader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Searching…
            </div>
          ) : error ? (
            <p className="px-4 py-4 text-sm text-danger-700">
              {getErrorMessage(error, "Search is unavailable right now.")}
            </p>
          ) : suggestions.length === 0 ? (
            <p className="px-4 py-4 text-sm text-concrete-500">
              No matches for “{debounced}”.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {suggestions.map((item, index) => (
                <li key={`${item.type}-${item.link}-${index}`}>
                  <button
                    type="button"
                    onClick={() => go(item.link)}
                    className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-concrete-50 focus-visible:bg-concrete-50"
                  >
                    <span className="mt-1 rounded bg-navy-50 px-1.5 py-0.5 font-display text-2xs font-semibold uppercase tracking-wide text-navy-600">
                      {TYPE_LABELS[item.type] || item.type}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-sm font-medium text-navy-900">
                        {item.title}
                      </span>
                      {item.subtitle && (
                        <span className="block truncate text-xs text-concrete-500">
                          {item.subtitle}
                        </span>
                      )}
                    </span>
                    <LuArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-concrete-300" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;

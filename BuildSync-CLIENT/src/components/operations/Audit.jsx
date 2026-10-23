import { useEffect, useMemo, useState } from "react";
import {
  LuChevronLeft,
  LuChevronRight,
  LuFilter,
  LuHistory,
  LuRotateCcw,
  LuSearch,
  LuShieldCheck,
  LuX,
} from "react-icons/lu";
import PageHeader from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import { Alert, EmptyState, PermissionDenied, TableSkeleton } from "../../components/ui/Feedback";
import DetailList, { DetailField } from "../../components/ui/DetailList";
import { Input, Select } from "../../components/ui/Form";
import { getErrorMessage, isPermissionError } from "../../lib/api";
import {
  useGetAuditEventsQuery,
  useGetAuditFacetsQuery,
} from "../../services/api/endpoints/platformApi";
import { formatDateTime } from "./shared";

const PAGE_SIZE = 50;

const ACTION_TONES = {
  "invoice.": "accent",
  "expense.": "warning",
  "payment.": "success",
  "project.": "navy",
  "dailyreport.": "info",
  "safety.": "danger",
};

const toneForAction = (action) => {
  const key = String(action || "").toLowerCase().split("_")[0];
  const match = Object.keys(ACTION_TONES).find((prefix) => key.startsWith(prefix));
  return match ? ACTION_TONES[match] : "neutral";
};

const labelAction = (action) =>
  String(action || "")
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const Audit = () => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // A new filter set is a new result set; staying on page 7 would show an
  // empty table even though page 1 has matches.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, entityType, action, actor, from, to]);

  const queryArgs = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      entityType: entityType || undefined,
      action: action || undefined,
      actor: actor || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [page, debouncedSearch, entityType, action, actor, from, to]
  );

  const { data, isLoading, isFetching, error, refetch } = useGetAuditEventsQuery(queryArgs);
  const facetsQuery = useGetAuditFacetsQuery();

  const events = data?.events ?? [];
  const pagination = data?.pagination ?? null;
  const facets = facetsQuery.data ?? { entityTypes: [], actions: [], actors: [] };
  const activeFilters = [entityType, action, actor, from, to].filter(Boolean).length;

  const resetFilters = () => {
    setSearch("");
    setEntityType("");
    setAction("");
    setActor("");
    setFrom("");
    setTo("");
    setPage(1);
  };

  if (isPermissionError(error)) {
    return (
      <>
        <PageHeader title="Audit Trail" />
        <Card><PermissionDenied /></Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Audit Trail"
        description="Immutable, append-only history of consequential actions across the platform. Entries cannot be edited or deleted."
        meta={
          <span className="inline-flex items-center gap-1.5 text-xs text-concrete-500">
            <LuShieldCheck className="h-3.5 w-3.5 text-success-600" aria-hidden="true" />
            Administrator-only · server-enforced
          </span>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters((open) => !open)}
              aria-expanded={showFilters}
            >
              <LuFilter className="h-4 w-4" aria-hidden="true" />
              Filters{activeFilters ? ` (${activeFilters})` : ""}
            </Button>
            <Button variant="outline" size="sm" onClick={refetch} loading={isFetching && !isLoading}>
              <LuRotateCcw className="h-4 w-4" aria-hidden="true" /> Refresh
            </Button>
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert variant="error">{getErrorMessage(error, "Could not load the audit trail.")}</Alert>
        </div>
      )}

      <Card>
        <div className="border-b border-concrete-200 px-4 py-3.5 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-concrete-400" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search actor, action or reason"
                aria-label="Search audit trail"
                className="w-full rounded-md border border-concrete-300 bg-white py-2 pl-9 pr-8 text-sm text-navy-900 placeholder:text-concrete-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-concrete-400 hover:bg-concrete-100 hover:text-navy-700"
                >
                  <LuX className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-concrete-500">
              {pagination && (
                <span>
                  {pagination.total} event{pagination.total === 1 ? "" : "s"} · page {pagination.page} of {pagination.pages}
                </span>
              )}
              {(activeFilters > 0 || debouncedSearch) && (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  Clear all
                </Button>
              )}
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 grid grid-cols-1 gap-3 border-t border-concrete-200 pt-4 sm:grid-cols-2 lg:grid-cols-5">
              <Select label="Entity" name="auditEntity" value={entityType} onChange={(event) => setEntityType(event.target.value)}>
                <option value="">All entities</option>
                {facets.entityTypes.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </Select>
              <Select label="Action" name="auditAction" value={action} onChange={(event) => setAction(event.target.value)}>
                <option value="">All actions</option>
                {facets.actions.map((value) => (
                  <option key={value} value={value}>{labelAction(value)}</option>
                ))}
              </Select>
              <Select label="Actor" name="auditActor" value={actor} onChange={(event) => setActor(event.target.value)}>
                <option value="">All actors</option>
                {facets.actors.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </Select>
              <Input label="From" name="auditFrom" type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
              <Input label="To" name="auditTo" type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
            </div>
          )}
        </div>

        {isLoading ? (
          <TableSkeleton rows={8} />
        ) : events.length === 0 ? (
          <EmptyState
            icon={LuHistory}
            title={activeFilters || debouncedSearch ? "No matching events" : "No audit events yet"}
            description={
              activeFilters || debouncedSearch
                ? "Try widening the date range or clearing a filter."
                : "The trail records approvals, payments, stock postings and other consequential changes."
            }
            action={
              activeFilters || debouncedSearch ? (
                <Button variant="outline" size="sm" onClick={resetFilters}>Clear filters</Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-concrete-200 bg-concrete-50">
                <tr>
                  {["When", "Actor", "Action", "Entity", "Transition", "Reason"].map((heading) => (
                    <th key={heading} scope="col" className="whitespace-nowrap px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wider text-concrete-500">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-concrete-100">
                {events.map((event) => (
                  <tr
                    key={event._id}
                    onClick={() => setSelected(event)}
                    className="cursor-pointer hover:bg-concrete-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-concrete-600">
                      {formatDateTime(event.createdAt)}
                    </td>
                    <td className="min-w-[10rem] px-4 py-3">
                      <p className="font-display text-sm font-medium text-navy-900">
                        {event.actor?.name || event.actorName || "System"}
                      </p>
                      <p className="text-xs capitalize text-concrete-500">{event.actorRole}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone={toneForAction(event.action)}>{labelAction(event.action)}</Badge>
                    </td>
                    <td className="min-w-[9rem] px-4 py-3">
                      <p className="font-display text-sm text-navy-800">{event.entityType}</p>
                      <p className="max-w-[10rem] truncate font-mono text-2xs text-concrete-400">{event.entityId}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-concrete-600">
                      {event.fromState || event.toState ? (
                        <>
                          <span className="text-concrete-400">{event.fromState || "—"}</span>
                          <span className="mx-1 text-concrete-300" aria-hidden="true">→</span>
                          <span className="font-medium text-navy-800">{event.toState || "—"}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="max-w-[18rem] px-4 py-3 text-xs text-concrete-600">
                      <span className="line-clamp-2">{event.reason || "—"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.pages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-concrete-200 px-4 py-3.5 sm:px-5">
            <p className="text-xs text-concrete-500">
              Showing {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                <LuChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
              </Button>
              <span className="font-display text-xs font-semibold uppercase tracking-wide text-concrete-500">
                {pagination.page} / {pagination.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.pages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next <LuChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Audit event"
        description="A sealed record of one consequential change."
        size="lg"
      >
        {selected && (
          <div className="space-y-5">
            <DetailList>
              <DetailField label="Event ID" value={<span className="font-mono text-xs">{selected._id}</span>} />
              <DetailField label="Occurred" value={formatDateTime(selected.createdAt)} />
              <DetailField label="Actor" value={selected.actor?.name || selected.actorName || "System"} />
              <DetailField label="Role" value={<span className="capitalize">{selected.actorRole}</span>} />
              <DetailField label="Entity" value={selected.entityType} />
              <DetailField label="Entity ID" value={<span className="font-mono text-xs">{selected.entityId}</span>} />
              <DetailField label="Action" value={labelAction(selected.action)} />
              <DetailField
                label="Transition"
                value={
                  selected.fromState || selected.toState
                    ? `${selected.fromState || "—"} → ${selected.toState || "—"}`
                    : "—"
                }
              />
              <DetailField
                label="Correlation ID"
                value={selected.correlationId ? <span className="font-mono text-xs">{selected.correlationId}</span> : "—"}
                className="sm:col-span-2"
              />
              <DetailField label="Reason" value={selected.reason || "—"} className="sm:col-span-2" />
            </DetailList>
            <div className="rounded-md border border-concrete-200 bg-concrete-50 px-3.5 py-3 text-xs leading-relaxed text-concrete-600">
              Audit events are append-only. They cannot be edited or deleted through any API route.
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default Audit;

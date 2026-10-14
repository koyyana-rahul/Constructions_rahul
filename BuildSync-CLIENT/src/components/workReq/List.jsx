import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LuClipboardList, LuPlus } from "react-icons/lu";
import PageHeader from "../ui/PageHeader";
import Button from "../ui/Button";
import { Card } from "../ui/Card";
import Toolbar, { FilterChips } from "../ui/Toolbar";
import ResponsiveList, { MobileCard } from "../ui/ResponsiveList";
import { StatusBadge } from "../ui/Badge";
import { Alert } from "../ui/Feedback";
import { useGetClientWorkRequestsQuery } from "../../services/api/endpoints/workRequestsApi";
import { getErrorMessage } from "../../lib/api";
import { useCurrentUser } from "../../features/auth/useSession";

const STATUS_OPTIONS = [
  { label: "All", value: "" },
  { label: "Pending", value: "Pending" },
  { label: "Approved", value: "Approved" },
  { label: "Rejected", value: "Rejected" },
];

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};

const columns = [
  {
    name: "#",
    selector: (row) => row.sno,
    width: "64px",
    cell: (row) => (
      <span className="font-display text-xs tabular-nums text-concrete-400">
        {String(row.sno).padStart(2, "0")}
      </span>
    ),
  },
  {
    name: "Request",
    selector: (row) => row.name,
    sortable: true,
    cell: (row) => (
      <span className="font-display font-semibold text-navy-900">{row.name}</span>
    ),
  },
  {
    name: "Duration",
    selector: (row) => row.startDate,
    cell: (row) => (
      <span className="whitespace-nowrap tabular-nums text-concrete-600">
        {formatDate(row.startDate)} → {formatDate(row.endDate)}
      </span>
    ),
  },
  {
    name: "Applied",
    selector: (row) => row.appliedAt,
    cell: (row) => <span className="tabular-nums">{formatDate(row.appliedAt)}</span>,
  },
  {
    name: "Status",
    selector: (row) => row.status,
    width: "120px",
    cell: (row) => <StatusBadge status={row.status} />,
  },
];

/** A client's own work requests. */
const WorkList = () => {
  const { id } = useParams();
  const user = useCurrentUser();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const isClientSelf = user?.role === "client";
  const role = user?.role ?? "client";

  // `id` and `role` are part of the cache key, so two clients never share an
  // entry. For a non-admin the server ignores the id and resolves the owner
  // from the verified token.
  const { data, error, isLoading, isFetching, refetch } = useGetClientWorkRequestsQuery(
    { id, role },
    { skip: !id }
  );

  const requests = useMemo(
    () =>
      (data ?? []).map((request, index) => ({
        ...request,
        sno: index + 1,
        appliedAt: request.appliedAt || request.createdAt,
      })),
    [data]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return requests.filter((request) => {
      const matchesStatus = !status || request.status === status;
      const matchesSearch =
        !term || `${request.name || ""} ${request.description || ""}`.toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [requests, search, status]);

  return (
    <>
      <PageHeader
        title={isClientSelf ? "My Work Requests" : "Client Work Requests"}
        description={
          isClientSelf
            ? "Track every request you have raised with your contractor."
            : "Work requests raised by this client."
        }
        breadcrumbs={[
          ...(isClientSelf
            ? [{ label: "Client Dashboard", to: "/client-dashboard" }]
            : [{ label: "Admin", to: "/admin-dashboard" }]),
          { label: "Work Requests" },
        ]}
        actions={
          <>
            {isFetching && !isLoading && (
              <span className="hidden text-xs text-concrete-400 sm:inline">Syncing…</span>
            )}
            {isClientSelf && (
              <Link to="/client-dashboard/add-work">
                <Button variant="accent">
                  <LuPlus className="h-4 w-4" aria-hidden="true" />
                  New Request
                </Button>
              </Link>
            )}
          </>
        }
      />

      {error && filtered.length > 0 && (
        <Alert variant="warning" className="mb-4 sm:mb-5">
          Showing the last known list. {getErrorMessage(error, "Live data is unavailable.")}
        </Alert>
      )}

      <Card className="overflow-hidden">
        <Toolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by request name"
          searchLabel="Search work requests"
        >
          <FilterChips
            options={STATUS_OPTIONS}
            value={status}
            onChange={setStatus}
            ariaLabel="Filter work requests by status"
          />
        </Toolbar>

        <ResponsiveList
          columns={columns}
          data={filtered}
          loading={isLoading}
          error={error && filtered.length === 0 ? getErrorMessage(error, null) : null}
          onRetry={refetch}
          searchActive={Boolean(search.trim()) || Boolean(status)}
          emptyIcon={LuClipboardList}
          emptyTitle={
            search.trim() || status
              ? "No work requests match these filters"
              : isClientSelf
              ? "You have not raised any work requests"
              : "No work requests for this client"
          }
          emptyDescription={
            search.trim() || status
              ? "Adjust the search term or status filter."
              : isClientSelf
              ? "Raise a request with dates and supporting documents to get started."
              : "Requests raised by this client will appear here."
          }
          emptyAction={
            isClientSelf &&
            !search.trim() &&
            !status && (
              <Link to="/client-dashboard/add-work">
                <Button variant="accent" size="sm">
                  <LuPlus className="h-4 w-4" aria-hidden="true" />
                  New Request
                </Button>
              </Link>
            )
          }
          mobileCard={(request) => (
            <MobileCard
              title={request.name}
              subtitle={request.description || "No description provided"}
              status={<StatusBadge status={request.status} />}
              meta={
                <>
                  <span>
                    {formatDate(request.startDate)} → {formatDate(request.endDate)}
                  </span>
                  {request.appliedAt && (
                    <span>Applied {formatDate(request.appliedAt)}</span>
                  )}
                </>
              }
            />
          )}
        />
      </Card>
    </>
  );
};

export default WorkList;
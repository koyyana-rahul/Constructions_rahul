import { useMemo, useState } from "react";
import { LuClipboardList } from "react-icons/lu";
import PageHeader from "../ui/PageHeader";
import Button from "../ui/Button";
import { Card } from "../ui/Card";
import Toolbar, { FilterChips } from "../ui/Toolbar";
import ResponsiveList, { MobileCard } from "../ui/ResponsiveList";
import { StatusBadge } from "../ui/Badge";
import { Alert } from "../ui/Feedback";
import { useQuery } from "../../hooks/useQuery";
import { api, getErrorMessage } from "../../lib/api";
import { columns, WorkRequestButtons } from "../../utils/WorkRequestHelper";

const STATUS_OPTIONS = [
  { label: "All", value: "" },
  { label: "Pending", value: "Pending" },
  { label: "Approved", value: "Approved" },
  { label: "Rejected", value: "Rejected" },
];

const WorkTable = () => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  // A client submitting a request must show up here without a manual refresh.
  const { data, error, isLoading, isRefreshing, refetch } = useQuery(
    ["work-requests"],
    async () => {
      const { data: res } = await api.get("/work-request", { params: { limit: 100 } });
      return res.success ? res.requests || [] : [];
    },
    { staleTime: 10_000, poll: 25_000 }
  );

  const requests = useMemo(
    () =>
      (data ?? []).map((request, index) => ({
        _id: request._id,
        sno: index + 1,
        name: request.name,
        clientName: request.clientId?.userId?.name,
        clientPhone: request.clientId?.phone,
        entityType: request.clientId?.entityType,
        startDate: request.startDate,
        endDate: request.endDate,
        details: request.details,
        description: request.description,
        appliedAt: request.appliedAt || request.createdAt,
        status: request.status,
      })),
    [data]
  );

  const counts = useMemo(
    () => ({
      all: requests.length,
      Pending: requests.filter((r) => r.status === "Pending").length,
      Approved: requests.filter((r) => r.status === "Approved").length,
      Rejected: requests.filter((r) => r.status === "Rejected").length,
    }),
    [requests]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return requests.filter((request) => {
      const matchesStatus = !status || request.status === status;
      const matchesSearch =
        !term ||
        `${request.name || ""} ${request.clientName || ""} ${request.clientPhone || ""}`
          .toLowerCase()
          .includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [requests, search, status]);

  return (
    <>
      <PageHeader
        title="Work Requests"
        description="Requests raised by clients, with scope, dates and supporting documents."
        breadcrumbs={[{ label: "Admin", to: "/admin-dashboard" }, { label: "Work Requests" }]}
        actions={
          isRefreshing && (
            <span className="hidden text-xs text-concrete-400 sm:inline">Syncing…</span>
          )
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
          searchPlaceholder="Search by request or client"
          searchLabel="Search work requests"
        >
          <FilterChips
            options={STATUS_OPTIONS.map((option) => ({
              ...option,
              count: option.value ? counts[option.value] : counts.all,
            }))}
            value={status}
            onChange={setStatus}
            ariaLabel="Filter work requests by status"
          />
        </Toolbar>

        <ResponsiveList
          columns={columns}
          data={filtered.map((request) => ({
            ...request,
            action: <WorkRequestButtons Id={request._id} />,
          }))}
          loading={isLoading}
          error={error && filtered.length === 0 ? getErrorMessage(error, null) : null}
          onRetry={refetch}
          searchActive={Boolean(search.trim()) || Boolean(status)}
          emptyIcon={LuClipboardList}
          emptyTitle={
            search.trim() || status
              ? "No work requests match these filters"
              : "No work requests yet"
          }
          emptyDescription={
            search.trim() || status
              ? "Adjust the search term or status filter to see more results."
              : "Requests raised by your clients will appear here."
          }
          emptyAction={
            (search.trim() || status) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                }}
              >
                Clear filters
              </Button>
            )
          }
          mobileCard={(request) => (
            <MobileCard
              title={request.name}
              subtitle={
                <>
                  {request.clientName || "Client"}
                  {request.clientPhone ? ` · ${request.clientPhone}` : ""}
                </>
              }
              status={<StatusBadge status={request.status} />}
              meta={
                <>
                  <span>
                    {new Date(request.startDate).toLocaleDateString()} →{" "}
                    {new Date(request.endDate).toLocaleDateString()}
                  </span>
                  {request.appliedAt && (
                    <span>Applied {new Date(request.appliedAt).toLocaleDateString()}</span>
                  )}
                </>
              }
              actions={<WorkRequestButtons Id={request._id} />}
            />
          )}
        />
      </Card>
    </>
  );
};

export default WorkTable;
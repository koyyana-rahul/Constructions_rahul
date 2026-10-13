import { useMemo, useState } from "react";
import { LuCalendarDays } from "react-icons/lu";
import PageHeader from "../ui/PageHeader";
import Button from "../ui/Button";
import { Card } from "../ui/Card";
import Toolbar, { FilterChips } from "../ui/Toolbar";
import ResponsiveList, { MobileCard } from "../ui/ResponsiveList";
import { StatusBadge } from "../ui/Badge";
import { Alert } from "../ui/Feedback";
import { useQuery } from "../../hooks/useQuery";
import { api, getErrorMessage } from "../../lib/api";
import { columns, LeaveButtons } from "../../utils/LeaveHelper";

const STATUS_OPTIONS = [
  { label: "All", value: "" },
  { label: "Pending", value: "Pending" },
  { label: "Approved", value: "Approved" },
  { label: "Rejected", value: "Rejected" },
];

const LeaveTable = () => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  // Approvals by another admin must appear without a manual refresh.
  const { data, error, isLoading, isRefreshing, refetch } = useQuery(
    ["leaves"],
    async () => {
      const { data: res } = await api.get("/leave", { params: { limit: 100 } });
      return res.success ? res.leaves || [] : [];
    },
    { staleTime: 10_000, poll: 30_000 }
  );

  const leaves = useMemo(() => {
    const list = (data ?? []).map((leave, index) => ({
      _id: leave._id,
      sno: index + 1,
      employeeId: leave.employeeId?.employeeId,
      name: leave.employeeId?.userId?.name,
      leaveType: leave.leaveType,
      department: leave.employeeId?.department?.dep_name,
      startDate: leave.startDate,
      endDate: leave.endDate,
      days:
        Math.round((new Date(leave.endDate) - new Date(leave.startDate)) / 86400000) || 0,
      status: leave.status,
    }));
    return list;
  }, [data]);

  const counts = useMemo(
    () => ({
      all: leaves.length,
      Pending: leaves.filter((l) => l.status === "Pending").length,
      Approved: leaves.filter((l) => l.status === "Approved").length,
      Rejected: leaves.filter((l) => l.status === "Rejected").length,
    }),
    [leaves]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leaves.filter((leave) => {
      const matchesStatus = !status || leave.status === status;
      const matchesSearch =
        !term ||
        `${leave.name || ""} ${leave.employeeId || ""} ${leave.department || ""} ${
          leave.leaveType || ""
        }`
          .toLowerCase()
          .includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [leaves, search, status]);

  return (
    <>
      <PageHeader
        title="Leave Requests"
        description="Review and action leave applications across your workforce."
        breadcrumbs={[{ label: "Admin", to: "/admin-dashboard" }, { label: "Leave Requests" }]}
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
          searchPlaceholder="Search by employee, ID, site or type"
          searchLabel="Search leave requests"
        >
          <FilterChips
            options={STATUS_OPTIONS.map((option) => ({
              ...option,
              count: option.value ? counts[option.value] : counts.all,
            }))}
            value={status}
            onChange={setStatus}
            ariaLabel="Filter leave requests by status"
          />
        </Toolbar>

        <ResponsiveList
          columns={columns}
          data={filtered.map((leave) => ({ ...leave, action: <LeaveButtons Id={leave._id} /> }))}
          loading={isLoading}
          error={error && filtered.length === 0 ? getErrorMessage(error, null) : null}
          onRetry={refetch}
          searchActive={Boolean(search.trim()) || Boolean(status)}
          emptyIcon={LuCalendarDays}
          emptyTitle={
            search.trim() || status
              ? "No leave requests match these filters"
              : "No leave requests yet"
          }
          emptyDescription={
            search.trim() || status
              ? "Adjust the search term or status filter to see more results."
              : "Leave applications raised by employees will appear here."
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
          mobileCard={(leave) => (
            <MobileCard
              title={leave.name || "Employee"}
              subtitle={
                <>
                  <span className="font-mono">{leave.employeeId}</span>
                  {leave.department ? ` · ${leave.department}` : ""}
                </>
              }
              status={<StatusBadge status={leave.status} />}
              meta={
                <>
                  <span className="font-display uppercase tracking-wide">
                    {leave.leaveType}
                  </span>
                  <span>
                    {new Date(leave.startDate).toLocaleDateString()} →{" "}
                    {new Date(leave.endDate).toLocaleDateString()}
                  </span>
                  <span>{leave.days} day(s)</span>
                </>
              }
              actions={<LeaveButtons Id={leave._id} />}
            />
          )}
        />
      </Card>
    </>
  );
};

export default LeaveTable;
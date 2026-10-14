import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LuCalendarDays, LuPlus } from "react-icons/lu";
import PageHeader from "../ui/PageHeader";
import Button from "../ui/Button";
import { Card } from "../ui/Card";
import Toolbar, { FilterChips } from "../ui/Toolbar";
import ResponsiveList, { MobileCard } from "../ui/ResponsiveList";
import { StatusBadge } from "../ui/Badge";
import { Alert } from "../ui/Feedback";
import { useGetEmployeeLeavesQuery } from "../../services/api/endpoints/leavesApi";
import { getErrorMessage } from "../../lib/api";
import { useCurrentUser } from "../../features/auth/useSession";
import EmployeeContextHeader, {
  EmployeeCrumb,
} from "../employee/EmployeeContextHeader";

const STATUS_OPTIONS = [
  { label: "All", value: "" },
  { label: "Pending", value: "Pending" },
  { label: "Approved", value: "Approved" },
  { label: "Rejected", value: "Rejected" },
];

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
    name: "Leave Type",
    selector: (row) => row.leaveType,
    sortable: true,
    cell: (row) => (
      <span className="font-display font-semibold uppercase tracking-wide text-navy-900">
        {row.leaveType}
      </span>
    ),
  },
  {
    name: "From",
    selector: (row) => row.startDate,
    cell: (row) => <span className="tabular-nums">{formatDate(row.startDate)}</span>,
  },
  {
    name: "To",
    selector: (row) => row.endDate,
    cell: (row) => <span className="tabular-nums">{formatDate(row.endDate)}</span>,
  },
  {
    name: "Days",
    selector: (row) => row.days,
    width: "80px",
    cell: (row) => <span className="tabular-nums">{row.days}</span>,
  },
  {
    name: "Reason",
    selector: (row) => row.reason,
    cell: (row) => <span className="line-clamp-2 max-w-sm">{row.reason || "—"}</span>,
  },
  {
    name: "Status",
    selector: (row) => row.status,
    width: "120px",
    cell: (row) => <StatusBadge status={row.status} />,
  },
];

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

/**
 * Personal leave list. Used from the employee's own dashboard and from the
 * admin's per-employee leave view.
 */
const LeaveList = () => {
  const { id } = useParams();
  const user = useCurrentUser();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const isEmployeeSelf = user?.role === "employee";
  const role = user?.role ?? "employee";

  /**
   * `id` and `role` are part of the RTK Query cache key, so Employee A's
   * history and Employee B's history are separate entries. Switching employees
   * switches the key, which means the previous employee's rows can never be
   * shown against the new selection - and a late response for the old id is
   * discarded rather than written over the new one.
   *
   * The URL id is a locator only: for a non-admin the backend ignores it and
   * resolves the employee from the verified token.
   */
  const { data, error, isLoading, isFetching, refetch } = useGetEmployeeLeavesQuery(
    { id, role },
    { skip: !id }
  );

  const leaves = useMemo(
    () =>
      (data ?? []).map((leave, index) => ({
        ...leave,
        sno: index + 1,
        days:
          Math.round((new Date(leave.endDate) - new Date(leave.startDate)) / 86400000) || 0,
      })),
    [data]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leaves.filter((leave) => {
      const matchesStatus = !status || leave.status === status;
      const matchesSearch =
        !term || `${leave.leaveType || ""} ${leave.reason || ""}`.toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [leaves, search, status]);

  return (
    <>
      <PageHeader
        title={isEmployeeSelf ? "My Leave Requests" : "Employee Leave Requests"}
        description={
          isEmployeeSelf
            ? "Track the status of every leave application you have raised."
            : "Review the leave history for this employee."
        }
        breadcrumbs={
          isEmployeeSelf
            ? [{ label: "My Dashboard", to: "/employee-dashboard" }, { label: "Leave Requests" }]
            : [
                { label: "Admin", to: "/admin-dashboard" },
                { label: "Employees", to: "/admin-dashboard/employees" },
                { label: <EmployeeCrumb id={id} />, to: `/admin-dashboard/employees/${id}` },
                { label: "Leave Requests" },
              ]
        }
        actions={
          <>
            {isFetching && !isLoading && (
              <span className="hidden text-xs text-concrete-400 sm:inline">Syncing…</span>
            )}
            {isEmployeeSelf && (
              <Link to="/employee-dashboard/add-leave">
                <Button variant="accent">
                  <LuPlus className="h-4 w-4" aria-hidden="true" />
                  Apply for Leave
                </Button>
              </Link>
            )}
          </>
        }
      />

      {/* Self-service pages show the caller's own name; the admin view needs
          an explicit identity header so it is never ambiguous whose
          records are on screen. */}
      {!isEmployeeSelf && <EmployeeContextHeader active="leave" />}

      {error && filtered.length > 0 && (
        <Alert variant="warning" className="mb-4 sm:mb-5">
          Showing the last known list. {getErrorMessage(error, "Live data is unavailable.")}
        </Alert>
      )}

      <Card className="overflow-hidden">
        <Toolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by leave type or reason"
          searchLabel="Search leave requests"
        >
          {isEmployeeSelf && (
            <FilterChips
              options={STATUS_OPTIONS}
              value={status}
              onChange={setStatus}
              ariaLabel="Filter leave requests by status"
            />
          )}
        </Toolbar>

        <ResponsiveList
          columns={columns}
          data={filtered}
          loading={isLoading}
          error={error && filtered.length === 0 ? getErrorMessage(error, null) : null}
          onRetry={refetch}
          searchActive={Boolean(search.trim()) || Boolean(status)}
          emptyIcon={LuCalendarDays}
          emptyTitle={
            search.trim() || status
              ? "No leave requests match these filters"
              : isEmployeeSelf
              ? "You have not applied for leave"
              : "No leave requests for this employee"
          }
          emptyDescription={
            search.trim() || status
              ? "Adjust the search term or status filter."
              : isEmployeeSelf
              ? "Submit a leave request and track its approval status here."
              : "Leave applications raised by this employee will appear here."
          }
          emptyAction={
            isEmployeeSelf &&
            !search.trim() &&
            !status && (
              <Link to="/employee-dashboard/add-leave">
                <Button variant="accent" size="sm">
                  <LuPlus className="h-4 w-4" aria-hidden="true" />
                  Apply for Leave
                </Button>
              </Link>
            )
          }
          mobileCard={(leave) => (
            <MobileCard
              title={leave.leaveType}
              subtitle={leave.reason || "No reason provided"}
              status={<StatusBadge status={leave.status} />}
              meta={
                <>
                  <span>
                    {formatDate(leave.startDate)} → {formatDate(leave.endDate)}
                  </span>
                  <span>{leave.days} day(s)</span>
                </>
              }
            />
          )}
        />
      </Card>
    </>
  );
};

export default LeaveList;
import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  LuHardHat,
  LuBuilding2,
  LuWallet,
  LuClipboardCheck,
  LuArrowRight,
  LuPlus,
  LuUserPlus,
  LuBuilding,
  LuCheckCircle2,
  LuPackage,
  LuShieldAlert,
} from "react-icons/lu";
import PageHeader from "../ui/PageHeader";
import StatCard from "../ui/StatCard";
import Button from "../ui/Button";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { StatusBadge } from "../ui/Badge";
import { Alert, CardSkeleton, EmptyState, PermissionDenied } from "../ui/Feedback";
import { getErrorMessage, isPermissionError } from "../../lib/api";
import { useGetDashboardSummaryQuery } from "../../services/api/endpoints/dashboardApi";
import { useGetReportOverviewQuery } from "../../services/api/endpoints/platformApi";
import StatusBreakdown from "./StatusBreakdown";
import { formatINRCompact } from "../../utils/format";

const LEAVE_STAGES = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "cancelled", label: "Cancelled" },
];

const WORK_STAGES = [
  { key: "pending", label: "Pending" },
  { key: "underReview", label: "Under Review" },
  { key: "approved", label: "Approved" },
  { key: "inProgress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "rejected", label: "Rejected" },
];

const QUICK_ACTIONS = [
  { to: "/admin-dashboard/add-employee", label: "Add Employee", icon: LuUserPlus },
  { to: "/admin-dashboard/add-client", label: "Add Client", icon: LuUserPlus },
  { to: "/admin-dashboard/add-department", label: "Add Site", icon: LuBuilding },
  { to: "/admin-dashboard/attendance", label: "Attendance", icon: LuClipboardCheck },
];

const formatTime = (iso) => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : `As of ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
};

/**
 * One approval queue row. `flex-wrap` keeps the status badge from colliding
 * with a long name, and `min-w-0` stops the name pushing the chevron out.
 */
const ApprovalRow = ({ to, name, subtitle, status }) => (
  <li className="px-4 py-3 sm:px-5">
    <Link
      to={to}
      className="flex items-start gap-2.5 rounded-md py-0.5 transition-colors hover:bg-concrete-50 focus-visible:bg-concrete-50"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="min-w-0 font-display text-sm font-semibold leading-snug text-navy-900 break-words">
            {name}
          </p>
          <StatusBadge status={status} />
        </div>
        {subtitle && (
          <p className="mt-0.5 text-xs leading-relaxed text-concrete-500 break-words">
            {subtitle}
          </p>
        )}
      </div>
      <LuArrowRight
        className="mt-0.5 h-4 w-4 shrink-0 text-concrete-300"
        aria-hidden="true"
      />
    </Link>
  </li>
);

const ApprovalCard = ({ title, description, viewAllTo, emptyText, items = [], renderItem }) => (
  <Card className="flex flex-col">
    <CardHeader
      title={title}
      description={description}
      actions={
        <Link
          to={viewAllTo}
          className="inline-flex shrink-0 items-center gap-1 rounded font-display text-xs font-semibold uppercase tracking-wide text-accent-600 transition-colors hover:text-accent-700 focus-visible:ring-2 focus-visible:ring-accent-500"
        >
          View all
          <LuArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      }
    />
    {/* `items.length`, not a truthiness check on the array - an empty array is
        truthy and previously rendered a blank card with no explanation. */}
    {items.length > 0 ? (
      <ul className="flex-1 divide-y divide-concrete-100">
        {items.map((item) => renderItem(item))}
      </ul>
    ) : (
      <p className="flex-1 px-4 py-8 text-center text-sm text-concrete-500 sm:px-5">
        {emptyText}
      </p>
    )}
  </Card>
);

const AdminSummary = () => {
  // Counts must reflect approvals without the admin refreshing by hand.
  // RTK Query owns this: the query polls in the background, and every mutation
  // in the app that can move a count declares the Dashboard tag.
  const {
    data: summary,
    error,
    isLoading: loading,
    isFetching,
    refetch: fetchSummary,
  } = useGetDashboardSummaryQuery();
  const { data: operationsData } = useGetReportOverviewQuery();
  const operations = operationsData?.overview;

  const exceptions = useMemo(() => {
    const source = summary?.operationalExceptions;
    if (!source) return [];
    return [
      {
        key: "unassigned",
        label: "Approved requests awaiting assignment",
        value: Number(source.approvedButUnassigned) || 0,
      },
      {
        key: "attendance",
        label: "Attendance not marked today",
        value: Number(source.unmarkedAttendanceToday) || 0,
      },
    ];
  }, [summary]);

  const openExceptions = exceptions.filter((item) => item.value > 0);

  if (loading) {
    return (
      <>
        <PageHeader title="Dashboard Overview" description="Loading your operational summary" />
        <CardSkeleton count={4} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard Overview"
        description="Live operational summary across your workforce, sites and requests."
        actions={
          <>
            {isFetching && !loading && (
              <span className="hidden text-xs text-concrete-400 sm:inline">Syncing…</span>
            )}
            <Link to="/admin-dashboard/add-employee" className="w-full sm:w-auto">
              <Button variant="accent" className="w-full sm:w-auto">
                <LuPlus className="h-4 w-4" aria-hidden="true" />
                Add Employee
              </Button>
            </Link>
          </>
        }
      />

      {isPermissionError(error) ? (
        <Card className="mb-4 border-warning-500/30 sm:mb-5">
          <PermissionDenied />
        </Card>
      ) : (
        error &&
        summary && (
          <Alert variant="warning" className="mb-4 sm:mb-5">
            Showing the last known summary. {getErrorMessage(error, "Live data is unavailable.")}
          </Alert>
        )
      )}

      {!summary ? (
        <EmptyState
          title={error ? "Could not load the summary" : "No summary available"}
          description={
            error
              ? getErrorMessage(error, null)
              : "Once employees, sites and requests exist, your operational summary will appear here."
          }
          action={
            <Button variant="outline" onClick={fetchSummary}>
              Try again
            </Button>
          }
        />
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* 1. Headline metrics */}
          <section aria-label="Key metrics">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <StatCard
                icon={LuHardHat}
                label="Total Employees"
                value={summary.totalEmployees ?? 0}
                hint={`${summary.activeEmployees ?? 0} active`}
                tone="navy"
              />
              <StatCard
                icon={LuBuilding2}
                label="Active Sites"
                value={summary.totalDepartments ?? 0}
                hint={
                  summary.archivedDepartments
                    ? `${summary.archivedDepartments} archived`
                    : "None archived"
                }
                tone="accent"
              />
              <StatCard
                icon={LuClipboardCheck}
                label="Pending Approvals"
                value={
                  (summary.pendingApprovals?.leave ?? 0) +
                  (summary.pendingApprovals?.workRequests ?? 0)
                }
                hint="Leave + work requests"
                tone={openExceptions.length ? "warning" : "success"}
              />
              <StatCard
                icon={LuWallet}
                label="Payroll Commitment"
                value={formatINRCompact(
                  summary.payrollCommitment?.monthlyConfiguredSalary ?? summary.totalSalary ?? 0
                )}
                hint="Configured monthly"
                tone="success"
              />
            </div>
          </section>

          {operations && (
            <section aria-label="Live operations snapshot">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-navy-800">
                  Operations snapshot
                </h2>
                <Link
                  to="/admin-dashboard/reports"
                  className="inline-flex items-center gap-1 font-display text-xs font-semibold uppercase tracking-wide text-accent-600 hover:text-accent-700"
                >
                  Full reports <LuArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                <StatCard
                  icon={LuWallet}
                  label="Outstanding"
                  value={formatINRCompact(operations.finance?.outstanding)}
                  hint={`${formatINRCompact(operations.finance?.overdue?.amount)} overdue`}
                  tone={operations.finance?.overdue?.amount ? "danger" : "success"}
                />
                <StatCard
                  icon={LuClipboardCheck}
                  label="Open tasks"
                  value={operations.tasks?.open ?? 0}
                  hint={`${operations.tasks?.overdue ?? 0} overdue`}
                  tone={operations.tasks?.overdue ? "warning" : "navy"}
                />
                <StatCard
                  icon={LuPackage}
                  label="Low stock"
                  value={operations.inventory?.lowStockCount ?? 0}
                  hint="At or below reorder"
                  tone={operations.inventory?.lowStockCount ? "warning" : "success"}
                />
                <StatCard
                  icon={LuShieldAlert}
                  label="Open incidents"
                  value={operations.safety?.openIncidents ?? 0}
                  hint={`${operations.safety?.criticalOpen ?? 0} high or critical`}
                  tone={operations.safety?.criticalOpen ? "danger" : "accent"}
                />
              </div>
            </section>
          )}

          {/* 2. Queue analytics */}
          <section aria-label="Request pipeline">
            <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:gap-6 xl:grid-cols-2">
              <StatusBreakdown
                title="Leave Requests"
                description="Applications awaiting or past a decision."
                stages={LEAVE_STAGES}
                counts={summary.leaveSummary}
                viewAllTo="/admin-dashboard/leaves"
              />
              <StatusBreakdown
                title="Work Requests"
                description="Full pipeline from submission to completion."
                stages={WORK_STAGES}
                counts={summary.workRequestSummary}
                viewAllTo="/admin-dashboard/work"
              />
            </div>
          </section>

          {/* 3. Approval queues */}
          <section aria-label="Pending approvals">
            <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:gap-6 xl:grid-cols-2">
              <ApprovalCard
                title="Pending Leave"
                description="Newest applications needing a decision."
                viewAllTo="/admin-dashboard/leaves"
                emptyText="No leave requests are waiting for approval."
                items={summary.pendingItems?.leaves ?? []}
                renderItem={(leave) => (
                  <ApprovalRow
                    key={leave._id}
                    to={`/admin-dashboard/leaves/${leave._id}`}
                    name={leave.employeeId?.userId?.name || "Employee"}
                    subtitle={`${leave.employeeId?.employeeId || "—"} · ${
                      leave.leaveType || "Leave"
                    }`}
                    status={leave.status}
                  />
                )}
              />

              <ApprovalCard
                title="Pending Work Requests"
                description="Submissions and reviews still open."
                viewAllTo="/admin-dashboard/work"
                emptyText="No work requests are waiting for approval."
                items={summary.pendingItems?.workRequests ?? []}
                renderItem={(request) => (
                  <ApprovalRow
                    key={request._id}
                    to={`/admin-dashboard/work/${request._id}`}
                    name={request.clientId?.userId?.name || request.name || "Client"}
                    subtitle={`${request.requestType || "Work request"} · ${
                      request.clientId?.entityType || "Client"
                    }`}
                    status={request.status}
                  />
                )}
              />
            </div>
          </section>

          {/* 4. Exceptions + quick actions */}
          <section aria-label="Operational exceptions and shortcuts">
            <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader
                  title="Needs Attention"
                  description={formatTime(summary.generatedAt) || "Operational exceptions"}
                />
                <CardBody className="space-y-2.5">
                  {openExceptions.length === 0 ? (
                    <p className="flex items-center gap-2 text-sm text-success-700">
                      <LuCheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                      No outstanding operational exceptions.
                    </p>
                  ) : (
                    exceptions.map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between gap-3 rounded-md bg-concrete-50 px-3 py-2.5"
                      >
                        <p className="min-w-0 text-sm leading-snug text-navy-800 break-words">
                          {item.label}
                        </p>
                        <span className="shrink-0 font-display text-base font-semibold tabular-nums text-warning-700">
                          {item.value}
                        </span>
                      </div>
                    ))
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Quick Actions" description="Common administrative tasks." />
                <CardBody>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {QUICK_ACTIONS.map(({ to, label, icon: Icon }) => (
                      <Link
                        key={to + label}
                        to={to}
                        className="flex items-center gap-2.5 rounded-md border border-concrete-200 px-3 py-2.5 text-sm font-medium text-navy-800 transition-colors hover:border-navy-300 hover:bg-navy-50 focus-visible:ring-2 focus-visible:ring-navy-400"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-navy-500" aria-hidden="true" />
                        <span className="min-w-0 truncate">{label}</span>
                      </Link>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </div>
          </section>
        </div>
      )}
    </>
  );
};

export default AdminSummary;
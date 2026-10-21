import { Link } from "react-router-dom";
import {
  LuCalendarDays,
  LuWallet,
  LuCheckCircle2,
  LuClock,
  LuPlus,
  LuArrowRight,
  LuUser,
} from "react-icons/lu";
import PageHeader from "../ui/PageHeader";
import StatCard from "../ui/StatCard";
import Button from "../ui/Button";
import { Card, CardHeader, CardBody } from "../ui/Card";
import ProgressBar from "../ui/ProgressBar";
import { Alert, CardSkeleton, EmptyState } from "../ui/Feedback";
import { useCurrentUser } from "../../features/auth/useSession";
import { useGetEmployeeLeavesQuery } from "../../services/api/endpoints/leavesApi";
import { useGetSalaryQuery } from "../../services/api/endpoints/salaryApi";
import { getErrorMessage } from "../../lib/api";
import { formatINR } from "../../utils/format";

const EmployeeSummary = () => {
  const user = useCurrentUser();
  const userId = user?._id;

  /**
   * Both reads are scoped by the SERVER to the signed-in employee: for a
   * non-admin the `:id` in the URL is ignored and the employee is resolved
   * from the verified token (see `getLeave` / `getSalary` in the API). The
   * queries are skipped until the session has resolved, so a deep link or a
   * refresh never fires a request with an undefined id.
   */
  const {
    data: leaves = [],
    error: leaveError,
    isLoading: leavesLoading,
    isFetching: leavesFetching,
    refetch: refetchLeaves,
  } = useGetEmployeeLeavesQuery({ id: userId, role: "employee" }, { skip: !userId });

  const {
    data: salary = [],
    error: salaryError,
    isLoading: salaryLoading,
    isFetching: salaryFetching,
    refetch: refetchSalary,
  } = useGetSalaryQuery({ id: userId, role: "employee" }, { skip: !userId });

  const error = leaveError ?? salaryError;
  const isLoading = leavesLoading || salaryLoading;
  const isRefreshing = leavesFetching || salaryFetching;
  // Retry only the query that failed, so a payroll outage does not re-issue
  // a leave request (and vice versa).
  const refetch = leaveError ? refetchLeaves : refetchSalary;

  const approved = leaves.filter((l) => l.status === "Approved").length;
  const pending = leaves.filter((l) => l.status === "Pending").length;
  const latestSalary = salary[0];

  return (
    <>
      <PageHeader
        title="My Dashboard"
        description="Your leave activity and salary records on this project."
        actions={
          <>
            {isRefreshing && (
              <span className="hidden text-xs text-concrete-400 sm:inline">Syncing…</span>
            )}
            <Link to="/employee-dashboard/add-leave">
              <Button variant="accent">
                <LuPlus className="h-4 w-4" aria-hidden="true" />
                Apply for Leave
              </Button>
            </Link>
          </>
        }
      />

      {error && leaves.length > 0 && (
        <Alert variant="warning" className="mb-4 sm:mb-5">
          Showing the last known data. {getErrorMessage(error, "Live data is unavailable.")}
        </Alert>
      )}

      {isLoading ? (
        <CardSkeleton count={3} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard
              icon={LuCalendarDays}
              label="Leave Requests"
              value={leaves.length}
              tone="navy"
            />
            <StatCard icon={LuClock} label="Pending" value={pending} tone="warning" />
            <StatCard icon={LuCheckCircle2} label="Approved" value={approved} tone="success" />
            <StatCard
              icon={LuWallet}
              label="Latest Net Salary"
              value={latestSalary ? formatINR(latestSalary.netSalary) : "—"}
              tone="accent"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Leave Requests"
                actions={
                  <Link
                    to={`/employee-dashboard/leaves/${user?._id}`}
                    className="inline-flex items-center gap-1 rounded font-display text-xs font-semibold uppercase tracking-wide text-accent-600 hover:text-accent-700"
                  >
                    View all
                    <LuArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                }
              />
              <CardBody className="space-y-4">
                {leaves.length === 0 ? (
                  <EmptyState
                    icon={LuCalendarDays}
                    title={error ? "Could not load your leave" : "No leave requests yet"}
                    description={
                      error
                        ? "Check your connection and try again."
                        : "Apply for leave and track its approval status here."
                    }
                    action={
                      error ? (
                        <Button variant="outline" size="sm" onClick={refetch}>
                          Try again
                        </Button>
                      ) : (
                        <Link to="/employee-dashboard/add-leave">
                          <Button variant="accent" size="sm">
                            Apply for Leave
                          </Button>
                        </Link>
                      )
                    }
                  />
                ) : (
                  <>
                    <ProgressBar
                      value={leaves.length ? (approved / leaves.length) * 100 : 0}
                      label="Approved share"
                      caption={`${approved} of ${leaves.length} decided`}
                      tone="success"
                      size="sm"
                      showValue
                    />
                    <ul className="space-y-2">
                      {leaves.slice(0, 5).map((leave) => (
                        <li
                          key={leave._id}
                          className="flex items-center justify-between gap-3 rounded-md bg-concrete-50 px-3 py-2.5"
                        >
                          <span className="min-w-0 truncate font-display text-sm font-medium text-navy-800">
                            {leave.leaveType}
                          </span>
                          <span
                            className={`shrink-0 font-display text-xs font-semibold uppercase tracking-wide ${
                              leave.status === "Approved"
                                ? "text-success-700"
                                : leave.status === "Rejected"
                                ? "text-danger-700"
                                : "text-warning-700"
                            }`}
                          >
                            {leave.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Salary Records"
                actions={
                  <Link
                    to={`/employee-dashboard/salary/${user?._id}`}
                    className="inline-flex items-center gap-1 rounded font-display text-xs font-semibold uppercase tracking-wide text-accent-600 hover:text-accent-700"
                  >
                    View all
                    <LuArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                }
              />
              <CardBody>
                {salary.length === 0 ? (
                  <EmptyState
                    icon={LuWallet}
                    title="No salary records"
                    description="Salary entries appear here once your administrator has processed payroll."
                  />
                ) : (
                  <ul className="space-y-2.5">
                    {salary.slice(0, 4).map((record) => (
                      <li
                        key={record._id}
                        className="flex items-center justify-between gap-3 border-b border-concrete-100 pb-2.5 last:border-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-display text-sm font-medium text-navy-800">
                            {record.payDate
                              ? new Date(record.payDate).toLocaleDateString()
                              : "Payroll entry"}
                          </p>
                          <p className="truncate text-xs text-concrete-500">
                            Basic {formatINR(record.basicSalary)} · Allow {formatINR(record.allowances)} · Deduct{" "}
                            {formatINR(record.deductions)}
                          </p>
                        </div>
                        <span className="shrink-0 font-display text-lg font-semibold tabular-nums text-navy-900">
                          {formatINR(record.netSalary)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader title="Quick Links" />
            <CardBody className="flex flex-wrap gap-3">
              <Link to={`/employee-dashboard/profile/${user?._id}`}>
                <Button variant="outline" size="sm">
                  <LuUser className="h-4 w-4" aria-hidden="true" />
                  My Profile
                </Button>
              </Link>
              <Link to="/employee-dashboard/setting">
                <Button variant="outline" size="sm">
                  Change Password
                </Button>
              </Link>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
};

export default EmployeeSummary;
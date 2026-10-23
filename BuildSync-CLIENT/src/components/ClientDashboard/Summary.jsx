import { Link } from "react-router-dom";
import {
  LuClipboardList,
  LuCheckCircle2,
  LuClock,
  LuXCircle,
  LuPlus,
  LuArrowRight,
  LuUser,
  LuFolderKanban,
  LuWallet,
  LuActivity,
} from "react-icons/lu";
import PageHeader from "../ui/PageHeader";
import StatCard from "../ui/StatCard";
import Button from "../ui/Button";
import { Card, CardHeader, CardBody } from "../ui/Card";
import ProgressBar from "../ui/ProgressBar";
import { Alert, CardSkeleton, EmptyState } from "../ui/Feedback";
import { useCurrentUser } from "../../features/auth/useSession";
import { useGetWorkRequestsQuery } from "../../services/api/endpoints/workRequestsApi";
import { useGetReportOverviewQuery } from "../../services/api/endpoints/platformApi";
import { getErrorMessage } from "../../lib/api";

const ClientSummary = () => {
  const user = useCurrentUser();

  /**
   * The API scopes this endpoint to the authenticated client
   * (see `clientIdFor()` in the work controller), so there is no client-side
   * filter to apply. Filtering here on `clientId._id === user._id` would
   * compare a Client._id against a User._id and never match.
   *
   * RTK Query polls in the background, so an administrator's decision reaches
   * this screen without the client having to reload.
   */
  const {
    data: requests,
    error,
    isLoading: loading,
    isFetching,
    refetch,
  } = useGetWorkRequestsQuery();

  const { data: operationsData } = useGetReportOverviewQuery();
  const operations = operationsData?.overview;

  const list = requests ?? [];
  const approved = list.filter((r) => r.status === "Approved").length;
  const pending = list.filter((r) => r.status === "Pending").length;
  const rejected = list.filter((r) => r.status === "Rejected").length;

  return (
    <>
      <PageHeader
        title="Client Dashboard"
        description="Track the work requests you have raised with your contractor."
        actions={
          <>
            {isFetching && !loading && (
              <span className="hidden text-xs text-concrete-400 sm:inline">Syncing…</span>
            )}
            <Link to="/client-dashboard/add-work">
              <Button variant="accent">
                <LuPlus className="h-4 w-4" aria-hidden="true" />
                New Work Request
              </Button>
            </Link>
          </>
        }
      />

      {error && (
        <Alert variant="error" className="mb-4 sm:mb-5" onDismiss={refetch}>
          {getErrorMessage(error, "Could not load your work requests.")}
        </Alert>
      )}

      {loading ? (
        <CardSkeleton count={3} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={LuClipboardList}
              label="Total Requests"
              value={list.length}
              tone="navy"
            />
            <StatCard icon={LuClock} label="Pending" value={pending} tone="warning" />
            <StatCard icon={LuCheckCircle2} label="Approved" value={approved} tone="success" />
            <StatCard icon={LuXCircle} label="Rejected" value={rejected} tone="danger" />
          </div>

          {operations && (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-navy-800">
                  Project & billing snapshot
                </h2>
                <Link
                  to="/client-dashboard/reports"
                  className="inline-flex items-center gap-1 font-display text-xs font-semibold uppercase tracking-wide text-accent-600 hover:text-accent-700"
                >
                  Full reports <LuArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                <StatCard
                  icon={LuFolderKanban}
                  label="Projects"
                  value={operations.projects?.total ?? 0}
                  hint={`${operations.projects?.active ?? 0} in progress`}
                  tone="navy"
                />
                <StatCard
                  icon={LuActivity}
                  label="Average progress"
                  value={`${operations.projects?.averageProgress ?? 0}%`}
                  hint="Across your projects"
                  tone="accent"
                />
                <StatCard
                  icon={LuWallet}
                  label="Outstanding"
                  value={new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: "INR",
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(Number(operations.finance?.outstanding) || 0)}
                  hint={`${operations.finance?.overdueCount ?? 0} overdue invoice(s)`}
                  tone={operations.finance?.overdueCount ? "warning" : "success"}
                />
                <StatCard
                  icon={LuCheckCircle2}
                  label="Site reports"
                  value={operations.recentReports?.length ?? 0}
                  hint="Recent approved reports"
                  tone="success"
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-3">
                <Link to="/client-dashboard/invoices" className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600 hover:text-accent-700">
                  View invoices
                </Link>
                <Link to="/client-dashboard/projects" className="font-display text-xs font-semibold uppercase tracking-wide text-accent-600 hover:text-accent-700">
                  View projects
                </Link>
              </div>
            </div>
          )}

          <Card>
            <CardHeader
              title="Recent Work Requests"
              actions={
                <Link
                  to={`/client-dashboard/work/${user?._id}`}
                  className="inline-flex items-center gap-1 font-display text-xs font-semibold uppercase tracking-wide text-accent-600 hover:text-accent-700"
                >
                  View all
                  <LuArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              }
            />
            <CardBody className="space-y-4">
              {list.length === 0 ? (
                <EmptyState
                  icon={LuClipboardList}
                  title={error ? "Could not load your requests" : "No work requests yet"}
                  description={
                    error
                      ? "Check your connection and try again."
                      : "Raise a work request to get your contractor started on a job."
                  }
                  action={
                    error ? (
                      <Button variant="outline" size="sm" onClick={refetch}>
                        Try again
                      </Button>
                    ) : (
                      <Link to="/client-dashboard/add-work">
                        <Button variant="accent" size="sm">
                          <LuPlus className="h-4 w-4" aria-hidden="true" />
                          New Work Request
                        </Button>
                      </Link>
                    )
                  }
                />
              ) : (
                <>
                  <ProgressBar
                    value={list.length ? (approved / list.length) * 100 : 0}
                    label="Approved share"
                    caption={`${approved} of ${list.length} decided`}
                    tone="success"
                    size="sm"
                    showValue
                  />
                  <ul className="divide-y divide-concrete-100">
                    {list.slice(0, 6).map((request) => (
                      <li
                        key={request._id}
                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-display text-sm font-medium text-navy-800">
                            {request.name}
                          </p>
                          <p className="text-xs text-concrete-500">
                            {request.startDate &&
                              `From ${new Date(request.startDate).toLocaleDateString()}`}
                            {request.endDate &&
                              ` to ${new Date(request.endDate).toLocaleDateString()}`}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 font-display text-xs font-semibold uppercase tracking-wide ${
                            request.status === "Approved"
                              ? "text-success-700"
                              : request.status === "Rejected"
                              ? "text-danger-700"
                              : "text-warning-700"
                          }`}
                        >
                          {request.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Quick Links" />
            <CardBody className="flex flex-wrap gap-3">
              <Link to={`/client-dashboard/profile/${user?._id}`}>
                <Button variant="outline" size="sm">
                  <LuUser className="h-4 w-4" aria-hidden="true" />
                  My Profile
                </Button>
              </Link>
              <Link to="/client-dashboard/setting">
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

export default ClientSummary;

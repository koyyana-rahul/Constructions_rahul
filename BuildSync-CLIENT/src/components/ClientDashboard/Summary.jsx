import { Link } from "react-router-dom";
import {
  LuClipboardList,
  LuCheckCircle2,
  LuClock,
  LuXCircle,
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
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { useQuery } from "../../hooks/useQuery";

const ClientSummary = () => {
  const { user } = useAuth();

  // The admin approving a request must show up here without a reload.
  const {
    data: requests,
    error,
    isLoading: loading,
    isRefreshing,
    refetch,
  } = useQuery(
    ["client-dashboard", user?._id],
    async () => {
      const { data: res } = await api.get("/work-request");
      if (!res.success) return [];

      // The server already scopes this endpoint to the authenticated client
      // (see clientIdFor() in the work controller), so no client-side filter
      // is applied. Filtering here on `clientId._id === user._id` would compare
      // a Client._id against a User._id and never match.
      return res.requests || [];
    },
    { staleTime: 10_000, poll: 25_000 }
  );

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
            {isRefreshing && (
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

      <Alert variant="error" className="mb-4 sm:mb-5" onDismiss={() => {}}>
        {error}
      </Alert>

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

          <Card>
            <CardHeader
              title="Recent Work Requests"
              actions={
                <Link
                  to={`/client-dashboard/work/${user?._id}`}
                  className="inline-flex items-center gap-1 rounded font-display text-xs font-semibold uppercase tracking-wide text-accent-600 hover:text-accent-700"
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
                            {request.requestType}
                            {request.startDate &&
                              ` · ${new Date(request.startDate).toLocaleDateString()}`}
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
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  LuCheckCircle2,
  LuXCircle,
  LuCalendarDays,
  LuHardHat,
  LuArrowLeft,
} from "react-icons/lu";
import PageHeader from "../ui/PageHeader";
import Button from "../ui/Button";
import { Card, CardHeader, CardBody } from "../ui/Card";
import DetailList, { DetailField } from "../ui/DetailList";
import Avatar from "../ui/Avatar";
import { StatusBadge } from "../ui/Badge";
import ConfirmDialog, { useConfirm } from "../ui/ConfirmDialog";
import { Alert, PageLoader } from "../ui/Feedback";
import {
  useGetLeaveByIdQuery,
  useUpdateLeaveStatusMutation,
} from "../../services/api/endpoints/leavesApi";
import { getErrorMessage, isPermissionError, assetUrl } from "../../lib/api";
import { formatDate } from "../../utils/tableUtils";

const LeaveDetail = () => {
  const { id } = useParams();

  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const confirm = useConfirm();

  const {
    data: leave,
    isLoading: loading,
    error: loadError,
  } = useGetLeaveByIdQuery(id, { skip: !id });

  // The mutation invalidates the record, the admin queue, the employee's own
  // history and the dashboard, so nothing is left showing a stale status.
  const [decide, { isPending }] = useUpdateLeaveStatusMutation();

  const changeStatus = async (status) => {
    confirm.setLoading(true);
    setError(null);
    try {
      await decide({ id, status }).unwrap();
      confirm.close();
      setNotice(`Leave request ${status.toLowerCase()}.`);
    } catch (err) {
      confirm.close();
      setError(getErrorMessage(err, "Unable to update the leave request."));
    } finally {
      confirm.setLoading(false);
    }
  };

  if (loading) return <PageLoader label="Loading leave request" />;

  // Guard on `!leave`, not on `error` - otherwise a success response with no
  // body falls through to `leave.employeeId` and crashes the page.
  if (!leave) {
    const forbidden = isPermissionError(loadError);
    return (
      <>
        <PageHeader title="Leave Request" />
        <Alert variant="error">
          {forbidden
            ? "You do not have permission to view this leave request."
            : loadError
            ? getErrorMessage(loadError, "Unable to load the leave request.")
            : "Leave request not found."}
        </Alert>
      </>
    );
  }

  const employee = leave.employeeId || {};
  const profileImage = assetUrl(employee.userId?.profileImage);
  const days =
    Math.round((new Date(leave.endDate) - new Date(leave.startDate)) / 86400000) || 0;

  return (
    <>
      <PageHeader
        title="Leave Request"
        description={`${employee.userId?.name || "Employee"} · ${leave.leaveType}`}
        breadcrumbs={[
          { label: "Admin", to: "/admin-dashboard" },
          { label: "Leave Requests", to: "/admin-dashboard/leaves" },
          { label: "Detail" },
        ]}
        meta={<StatusBadge status={leave.status} />}
        actions={
          <>
            <Link to="/admin-dashboard/leaves">
              <Button variant="outline" size="sm">
                <LuArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to list
              </Button>
            </Link>
            {leave.status === "Pending" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-danger-500 text-danger-600 hover:bg-danger-50"
                  disabled={isPending}
                  onClick={() => confirm.open("Rejected")}
                >
                  <LuXCircle className="h-4 w-4" aria-hidden="true" />
                  Reject
                </Button>
                <Button
                  variant="accent"
                  size="sm"
                  disabled={isPending}
                  onClick={() => confirm.open("Approved")}
                >
                  <LuCheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Approve
                </Button>
              </>
            )}
          </>
        }
      />

      <Alert variant="error" className="mb-4 sm:mb-5" onDismiss={() => setError(null)}>
        {error}
      </Alert>
      <Alert variant="success" className="mb-4 sm:mb-5" onDismiss={() => setNotice(null)}>
        {notice}
      </Alert>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardBody className="flex flex-col items-center text-center">
            <Avatar src={profileImage} name={employee.userId?.name} size="xl" />
            <h2 className="mt-4 font-display text-lg font-semibold uppercase tracking-wide text-navy-900">
              {employee.userId?.name}
            </h2>
            <p className="mt-0.5 font-mono text-xs text-concrete-500">
              {employee.employeeId}
            </p>
            <div className="mt-3">
              <StatusBadge status={employee.department?.dep_name ? "active" : "inactive"}>
                {employee.department?.dep_name || "Unassigned site"}
              </StatusBadge>
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Request Details"
            actions={
              <LuCalendarDays className="h-4 w-4 text-concrete-400" aria-hidden="true" />
            }
          />
          <CardBody className="space-y-6">
            <DetailList>
              <DetailField label="Leave type" value={leave.leaveType} />
              <DetailField label="Duration" value={`${days} day(s)`} />
              <DetailField label="Start date" value={formatDate(leave.startDate)} />
              <DetailField label="End date" value={formatDate(leave.endDate)} />
              <DetailField label="Applied on" value={formatDate(leave.createdAt)} />
              <DetailField
                label="Construction site"
                value={employee.department?.dep_name}
              />
            </DetailList>

            <div>
              <p className="font-display text-2xs font-semibold uppercase tracking-wider text-concrete-500">
                Reason
              </p>
              <p className="mt-2 whitespace-pre-line rounded-md bg-concrete-50 p-4 text-sm leading-relaxed text-navy-800">
                {leave.reason || "—"}
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      {leave.status !== "Pending" && (
        <p className="mt-5 flex items-center gap-2 text-xs text-concrete-500">
          <LuHardHat className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          This request has already been {leave.status.toLowerCase()} and can no longer be
          changed.
        </p>
      )}

      <ConfirmDialog
        open={confirm.confirmOpen}
        loading={confirm.loading}
        title={
          confirm.target === "Approved" ? "Approve leave request" : "Reject leave request"
        }
        description={
          confirm.target === "Approved"
            ? `${employee.userId?.name || "This employee"}'s leave will be marked as approved.`
            : `${employee.userId?.name || "This employee"}'s leave will be marked as rejected.`
        }
        confirmLabel={confirm.target === "Approved" ? "Approve request" : "Reject request"}
        variant={confirm.target === "Approved" ? "accent" : "danger"}
        onCancel={confirm.close}
        onConfirm={() => changeStatus(confirm.target)}
      />
    </>
  );
};

export default LeaveDetail;
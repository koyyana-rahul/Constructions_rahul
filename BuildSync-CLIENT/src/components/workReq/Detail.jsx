import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  LuCheckCircle2,
  LuXCircle,
  LuClipboardList,
  LuFileText,
  LuDownload,
  LuArrowLeft,
} from "react-icons/lu";
import PageHeader from "../ui/PageHeader";
import Button from "../ui/Button";
import { Card, CardHeader, CardBody } from "../ui/Card";
import DetailList, { DetailField } from "../ui/DetailList";
import { Textarea } from "../ui/Form";
import Avatar from "../ui/Avatar";
import { StatusBadge } from "../ui/Badge";
import ConfirmDialog, { useConfirm } from "../ui/ConfirmDialog";
import { Alert, PageLoader } from "../ui/Feedback";
import { api, getErrorMessage } from "../../lib/api";
import { useMutation } from "../../hooks/useQuery";
import { formatDate } from "../../utils/tableUtils";

const WorkDetail = () => {
  const { id } = useParams();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionError, setRejectionError] = useState(undefined);
  const confirm = useConfirm();

  const fetchRequest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/work-request/detail/${id}`);
      if (data.success) setRequest(data.request || data.workRequest);
      else setError("Work request not found.");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load the work request."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  // The admin queue, the client view and the dashboard counts all refresh
  // from the server-confirmed change.
  const { mutate: decide } = useMutation(
    async ({ status, rejectionReason }) => {
      // The API requires `rejectionReason` whenever status is Rejected.
      const body = status === "Rejected" ? { status, rejectionReason } : { status };
      const { data } = await api.put(`/work-request/${id}`, body);
      if (!data.success) throw new Error("Unable to update the work request.");
      return data;
    },
    { invalidate: ["work-requests", "client-dashboard", "dashboard-summary"] }
  );

  const changeStatus = async (status, rejectionReason) => {
    confirm.setLoading(true);
    setError(null);
    try {
      await decide({ status, rejectionReason });
      confirm.close();
      setNotice(`Work request ${status.toLowerCase()}.`);
      const fresh = await api.get(`/work-request/detail/${id}`);
      if (fresh.data?.success) setRequest(fresh.data.request);
    } catch (err) {
      confirm.close();
      setError(getErrorMessage(err, "Unable to update the work request."));
    } finally {
      confirm.setLoading(false);
    }
  };

  if (loading) return <PageLoader label="Loading work request" />;

  // Guard on `!request`, not on `error` - the server can answer
  // `{ success: true }` without a body, which would otherwise fall through to
  // `request.clientId` and crash the page.
  if (!request) {
    return (
      <>
        <PageHeader title="Work Request" />
        <Alert variant="error">{error || "Work request not found."}</Alert>
      </>
    );
  }

  const client = request.clientId || {};
  const avatar = client.userId?.profileImage
    ? `http://localhost:5000/${client.userId.profileImage}`
    : undefined;
  const days =
    Math.round((new Date(request.endDate) - new Date(request.startDate)) / 86400000) || 0;

  return (
    <>
      <PageHeader
        title={request.name || "Work Request"}
        description={`Raised by ${client.userId?.name || "client"}`}
        breadcrumbs={[
          { label: "Admin", to: "/admin-dashboard" },
          { label: "Work Requests", to: "/admin-dashboard/work" },
          { label: "Detail" },
        ]}
        meta={<StatusBadge status={request.status} />}
        actions={
          <>
            <Link to="/admin-dashboard/work">
              <Button variant="outline" size="sm">
                <LuArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to list
              </Button>
            </Link>
            {request.status === "Pending" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-danger-500 text-danger-600 hover:bg-danger-50"
                  onClick={() => {
                    setRejectionReason("");
                    setRejectionError(undefined);
                    confirm.open("Rejected");
                  }}
                >
                  <LuXCircle className="h-4 w-4" aria-hidden="true" />
                  Reject
                </Button>
                <Button
                  variant="accent"
                  size="sm"
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
            <Avatar src={avatar} name={client.userId?.name} size="xl" />
            <h2 className="mt-4 font-display text-lg font-semibold uppercase tracking-wide text-navy-900">
              {client.userId?.name || "—"}
            </h2>
            {client.companyName && (
              <p className="mt-0.5 text-sm text-concrete-600">{client.companyName}</p>
            )}
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <StatusBadge status={client.entityType} />
              {client.phone && <StatusBadge tone="neutral">{client.phone}</StatusBadge>}
            </div>
          </CardBody>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Request Details"
              actions={
                <LuClipboardList className="h-4 w-4 text-concrete-400" aria-hidden="true" />
              }
            />
            <CardBody className="space-y-6">
              <DetailList>
                <DetailField label="Request name" value={request.name} />
                <DetailField label="Duration" value={`${days} day(s)`} />
                <DetailField label="Start date" value={formatDate(request.startDate)} />
                <DetailField label="End date" value={formatDate(request.endDate)} />
                <DetailField
                  label="Applied on"
                  value={formatDate(request.appliedAt || request.createdAt)}
                />
                <DetailField label="Entity type" value={client.entityType} />
              </DetailList>

              <div>
                <p className="font-display text-2xs font-semibold uppercase tracking-wider text-concrete-500">
                  Scope of work
                </p>
                <p className="mt-2 whitespace-pre-line rounded-md bg-concrete-50 p-4 text-sm leading-relaxed text-navy-800">
                  {request.description || "No scope of work was provided."}
                </p>
              </div>

              {request.details && (
                <div>
                  <p className="font-display text-2xs font-semibold uppercase tracking-wider text-concrete-500">
                    Supporting document
                  </p>
                  <a
                    href={`http://localhost:5000/${request.details}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-3 rounded-md border border-concrete-200 bg-white px-4 py-3 text-sm text-navy-800 transition-colors hover:border-navy-400 hover:bg-navy-50"
                  >
                    <LuFileText className="h-4 w-4 shrink-0 text-concrete-400" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">
                      {request.details}
                    </span>
                    <LuDownload className="h-4 w-4 shrink-0 text-concrete-400" aria-hidden="true" />
                  </a>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirm.confirmOpen}
        loading={confirm.loading}
        title={
          confirm.target === "Approved"
            ? "Approve work request"
            : "Reject work request"
        }
        description={
          confirm.target === "Approved"
            ? `"${request.name}" will be marked as approved and the client notified in their dashboard.`
            : `"${request.name}" will be marked as rejected. The client sees the reason below.`
        }
        confirmLabel={confirm.target === "Approved" ? "Approve request" : "Reject request"}
        variant={confirm.target === "Approved" ? "accent" : "danger"}
        onCancel={confirm.close}
        onConfirm={() => {
          // The API rejects a blank reason with HTTP 400, so catch it first
          // and keep the dialog open for the admin to complete it.
          if (confirm.target === "Rejected" && !rejectionReason.trim()) {
            setRejectionError("A reason is required when rejecting a request");
            return;
          }
          changeStatus(confirm.target, rejectionReason.trim());
        }}
      >
        {confirm.target === "Rejected" ? (
          <Textarea
            label="Reason for rejection"
            name="rejectionReason"
            rows={3}
            placeholder="Explain to the client why this request cannot proceed"
            value={rejectionReason}
            onChange={(e) => {
              setRejectionReason(e.target.value);
              setRejectionError(undefined);
            }}
            error={rejectionError}
            required
            hint="This is shown to the client in their work request history."
          />
        ) : (
          <p className="text-sm leading-relaxed text-concrete-600">
            This action cannot be undone.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
};

export default WorkDetail;
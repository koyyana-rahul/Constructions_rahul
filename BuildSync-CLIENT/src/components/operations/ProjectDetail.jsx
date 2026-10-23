import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  LuArchive,
  LuArrowLeft,
  LuCheckCircle2,
  LuDownload,
  LuFileText,
  LuMapPin,
  LuPencil,
  LuPlus,
  LuRotateCcw,
  LuTrash2,
} from "react-icons/lu";
import PageHeader from "../../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { DetailField, default as DetailList } from "../../components/ui/DetailList";
import Button from "../../components/ui/Button";
import Badge, { StatusBadge } from "../../components/ui/Badge";
import ProgressBar from "../../components/ui/ProgressBar";
import Modal from "../../components/ui/Modal";
import ConfirmDialog, { useConfirm } from "../../components/ui/ConfirmDialog";
import { Alert, EmptyState, PermissionDenied } from "../../components/ui/Feedback";
import { Input, Select } from "../../components/ui/Form";
import { formatINR } from "../../utils/format";
import { downloadAuthenticated } from "../../lib/download";
import { getErrorMessage, isPermissionError } from "../../lib/api";
import { useAppSelector } from "../../app/hooks";
import { selectHomePath } from "../../features/auth/authSelectors";
import { useCurrentUser } from "../../features/auth/useSession";
import {
  useArchiveProjectMutation,
  useDeleteProjectMutation,
  useGetProjectQuery,
  useRestoreProjectMutation,
  useUpdateProjectMutation,
  useAddMilestoneMutation,
  useUpdateMilestoneMutation,
  useDeleteMilestoneMutation,
} from "../../services/api/endpoints/projectsApi";
import { useGetTasksQuery } from "../../services/api/endpoints/fieldApi";
import { useGetDailyReportsQuery } from "../../services/api/endpoints/fieldApi";
import { useGetDocumentsQuery } from "../../services/api/endpoints/fieldApi";
import {
  employeeName,
  formatDate,
  projectName,
} from "../../components/operations/shared";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "tasks", label: "Tasks" },
  { key: "reports", label: "Daily reports" },
  { key: "documents", label: "Documents" },
  { key: "milestones", label: "Milestones" },
];

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const basePath = useAppSelector(selectHomePath);
  const admin = user?.role === "admin";
  const client = user?.role === "client";

  const [tab, setTab] = useState("overview");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [milestone, setMilestone] = useState({ title: "", dueDate: "", weight: 1 });
  const confirm = useConfirm();
  const milestoneConfirm = useConfirm();

  const { data: project, isLoading, error: loadError, refetch } = useGetProjectQuery(id);
  const { data: taskData } = useGetTasksQuery({ project: id, limit: 100 }, { skip: tab !== "tasks" });
  const { data: reportData } = useGetDailyReportsQuery({ project: id, limit: 20 }, { skip: tab !== "reports" });
  const { data: documentData } = useGetDocumentsQuery({ project: id, limit: 50 }, { skip: tab !== "documents" });

  const [updateProject, updateState] = useUpdateProjectMutation();
  const [archiveProject, archiveState] = useArchiveProjectMutation();
  const [restoreProject, restoreState] = useRestoreProjectMutation();
  const [deleteProject, deleteState] = useDeleteProjectMutation();
  const [addMilestone, addState] = useAddMilestoneMutation();
  const [updateMilestone] = useUpdateMilestoneMutation();
  const [deleteMilestone, deleteMilestoneState] = useDeleteMilestoneMutation();

  const tasks = taskData?.tasks ?? [];
  const reports = reportData?.reports ?? [];
  const documents = documentData?.documents ?? [];

  const visibleTabs = useMemo(
    () => (admin || client ? [...TABS.slice(0, 4), ...TABS.slice(4)] : TABS),
    [admin, client]
  );

  if (isLoading) {
    return <Card><CardBody><p className="py-10 text-center text-sm text-concrete-500">Loading project…</p></CardBody></Card>;
  }

  if (isPermissionError(loadError)) {
    return (
      <>
        <PageHeader title="Project" breadcrumbs={[{ label: "Projects", to: `${basePath}/projects` }, { label: "Restricted" }]} />
        <Card><PermissionDenied /></Card>
      </>
    );
  }

  if (loadError || !project) {
    return (
      <>
        <PageHeader title="Project" breadcrumbs={[{ label: "Projects", to: `${basePath}/projects` }, { label: "Not found" }]} />
        <Card>
          <EmptyState
            title="Could not open this project"
            description={getErrorMessage(loadError, "The project may have been removed.")}
            action={<Button variant="outline" onClick={refetch}>Try again</Button>}
          />
        </Card>
      </>
    );
  }

  const onStatusSave = async () => {
    if (!status || status === project.status) return;
    setError("");
    try {
      await updateProject({ id, status }).unwrap();
      setStatus("");
    } catch (statusError) {
      setError(getErrorMessage(statusError, "The status could not be changed."));
    }
  };

  const onArchive = async () => {
    try {
      await archiveProject({ id, reason: "Archived from project detail" }).unwrap();
      confirm.close();
    } catch (archiveError) {
      setError(getErrorMessage(archiveError));
    }
  };

  const onRestore = async () => {
    try {
      await restoreProject(id).unwrap();
    } catch (restoreError) {
      setError(getErrorMessage(restoreError));
    }
  };

  const onDelete = async () => {
    try {
      await deleteProject(id).unwrap();
      confirm.close();
      navigate(`${basePath}/projects`);
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
      confirm.close();
    }
  };

  const onDeleteMilestone = async () => {
    try {
      await deleteMilestone({ id, milestoneId: milestoneConfirm.target.id }).unwrap();
      milestoneConfirm.close();
    } catch (milestoneError) {
      setError(getErrorMessage(milestoneError));
      milestoneConfirm.close();
    }
  };

  const onAddMilestone = async (event) => {
    event.preventDefault();
    if (!milestone.title.trim()) return;
    try {
      await addMilestone({ id, ...milestone, weight: Number(milestone.weight) || 1 }).unwrap();
      setMilestone({ title: "", dueDate: "", weight: 1 });
      setMilestoneOpen(false);
    } catch (milestoneError) {
      setError(getErrorMessage(milestoneError));
    }
  };

  const projectFinance = project.finance;

  return (
    <>
      <PageHeader
        title={projectName(project)}
        description={project.description || `${project.code} · ${project.site?.dep_name || "No site"}`}
        breadcrumbs={[
          { label: "Projects", to: `${basePath}/projects` },
          { label: project.code },
        ]}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={project.status} />
            <StatusBadge status={project.health || "On Track"} />
            <StatusBadge status={project.priority || "Normal"} />
            {project.isArchived && <Badge tone="neutral">Archived</Badge>}
          </div>
        }
        actions={
          <>
            <Link to={`${basePath}/projects`}>
              <Button variant="outline" size="sm">
                <LuArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
              </Button>
            </Link>
            {admin && (
              <>
                <Link to={`${basePath}/projects/${id}/edit`}>
                  <Button variant="outline" size="sm">
                    <LuPencil className="h-4 w-4" aria-hidden="true" /> Edit
                  </Button>
                </Link>
                {project.isArchived ? (
                  <Button variant="outline" size="sm" onClick={onRestore} loading={restoreState.isLoading}>
                    <LuRotateCcw className="h-4 w-4" aria-hidden="true" /> Restore
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => confirm.open("archive")}>
                    <LuArchive className="h-4 w-4" aria-hidden="true" /> Archive
                  </Button>
                )}
              </>
            )}
          </>
        }
      />

      <Alert variant="error" className="mb-4">{error}</Alert>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-concrete-200 pb-px">
        {visibleTabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            aria-pressed={tab === item.key}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 font-display text-xs font-semibold uppercase tracking-wide transition-colors ${
              tab === item.key
                ? "border-accent-600 text-accent-700"
                : "border-transparent text-concrete-500 hover:text-navy-800"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader title="Delivery" description="Schedule, site and physical progress." />
            <CardBody className="space-y-5">
              <ProgressBar
                value={project.progress ?? 0}
                label="Physical progress"
                showPercentage
                size="lg"
                tone={project.health === "Delayed" ? "danger" : "accent"}
              />
              <DetailList columns={3}>
                <DetailField label="Project code" value={project.code} />
                <DetailField label="Site" value={<span className="inline-flex items-center gap-1.5"><LuMapPin className="h-4 w-4 text-concrete-400" />{project.site?.dep_name || "—"}</span>} />
                <DetailField label="Client" value={project.client?.companyName || project.client?.userId?.name || "Internal"} />
                <DetailField label="Start" value={formatDate(project.startDate)} />
                <DetailField label="Planned end" value={formatDate(project.endDate)} />
                <DetailField label="Actual end" value={formatDate(project.actualEndDate)} />
                <DetailField label="Manager" value={employeeName(project.manager)} />
                <DetailField label="Team size" value={`${project.teamMembers?.length ?? project.team?.length ?? 0} people`} />
                <DetailField label="Daily reports" value={project.dailyReportCount ?? 0} />
              </DetailList>
              {project.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {project.tags.map((tag) => (
                    <Badge key={tag} tone="neutral">{tag}</Badge>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader title="Task delivery" description="Work items on this project." />
              <CardBody className="space-y-3">
                <ProgressBar
                  value={project.taskSummary?.completion ?? 0}
                  label="Tasks complete"
                  caption={`${project.taskSummary?.done ?? 0}/${project.taskSummary?.total ?? 0}`}
                  showPercentage
                  tone="success"
                />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-concrete-50 p-2">
                    <p className="font-display text-lg font-semibold text-navy-900">{project.taskSummary?.open ?? 0}</p>
                    <p className="text-2xs uppercase tracking-wide text-concrete-500">Open</p>
                  </div>
                  <div className="rounded-md bg-warning-50 p-2">
                    <p className="font-display text-lg font-semibold text-warning-700">{project.taskSummary?.blocked ?? 0}</p>
                    <p className="text-2xs uppercase tracking-wide text-concrete-500">Blocked</p>
                  </div>
                  <div className="rounded-md bg-accent-50 p-2">
                    <p className="font-display text-lg font-semibold text-accent-700">{project.taskSummary?.inProgress ?? 0}</p>
                    <p className="text-2xs uppercase tracking-wide text-concrete-500">Doing</p>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Team" description="People assigned to this project." />
              <CardBody>
                {project.teamMembers?.length ? (
                  <ul className="space-y-2.5">
                    {project.teamMembers.map((member) => (
                      <li key={member._id} className="flex items-start gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-100 font-display text-xs font-semibold text-navy-700">
                          {(member.userId?.name || "?").slice(0, 1)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-navy-900">{member.userId?.name || member.employeeId}</p>
                          <p className="text-xs text-concrete-500">{member.designation || "Team member"}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-concrete-500">No team members have been assigned yet.</p>
                )}
              </CardBody>
            </Card>

            {admin && (
              <Card>
                <CardHeader title="Project controls" description="Move the project through its lifecycle." />
                <CardBody className="space-y-3">
                  {project.status !== "Cancelled" && (
                    <>
                      <Select label="New status" value={status} onChange={(event) => setStatus(event.target.value)}>
                        <option value="">Choose a transition</option>
                        {["Planning", "Mobilisation", "In Progress", "On Hold", "Completed", "Handover", "Closed", "Cancelled"]
                          .filter((value) => value !== project.status)
                          .map((value) => <option key={value} value={value}>{value}</option>)}
                      </Select>
                      <Button variant="primary" size="sm" onClick={onStatusSave} loading={updateState.isLoading} disabled={!status}>
                        <LuCheckCircle2 className="h-4 w-4" aria-hidden="true" /> Apply status
                      </Button>
                    </>
                  )}
                  <div className="border-t border-concrete-100 pt-3">
                    <Button variant="danger-outline" size="sm" onClick={() => confirm.open("delete")}>
                      <LuTrash2 className="h-4 w-4" aria-hidden="true" /> Delete permanently
                    </Button>
                    <p className="mt-1 text-2xs text-concrete-500">
                      Only projects with no financial or field records can be deleted. Archive preserves history.
                    </p>
                  </div>
                </CardBody>
              </Card>
            )}
          </div>

          {(admin || client) && projectFinance && (
            <Card className="xl:col-span-3">
              <CardHeader
                title={admin ? "Commercial position" : "Billing summary"}
                description={admin ? "Budget, cost and client billing for this project." : "What has been billed, paid and remains outstanding."}
              />
              <CardBody>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                  {admin ? (
                    <>
                      <DetailField label="Contract" value={formatINR(project.contractValue)} />
                      <DetailField label="Estimated cost" value={formatINR(project.estimatedCost)} />
                      <DetailField label="Cost to date" value={formatINR(projectFinance.costToDate)} />
                      <DetailField label="Remaining budget" value={formatINR(project.budget?.remainingBudget)} />
                      <DetailField label="Billed" value={formatINR(projectFinance.billed)} />
                      <DetailField label="Outstanding" value={formatINR(projectFinance.outstanding)} />
                    </>
                  ) : (
                    <>
                      <DetailField label="Contract value" value={formatINR(project.contractValue)} />
                      <DetailField label="Billed" value={formatINR(projectFinance.billed)} />
                      <DetailField label="Paid" value={formatINR(projectFinance.collected)} />
                      <DetailField label="Outstanding" value={formatINR(projectFinance.outstanding)} />
                      <DetailField label="Invoices" value={projectFinance.invoiceCount} />
                    </>
                  )}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {tab === "tasks" && (
        <Card>
          <CardHeader
            title="Project tasks"
            description="Work assigned against this project. Task owners update status and hours on the Tasks page."
            actions={
              admin ? (
                <Link to={`${basePath}/tasks?project=${id}`}>
                  <Button variant="outline" size="sm"><LuPlus className="h-4 w-4" /> Add task</Button>
                </Link>
              ) : null
            }
          />
          {tasks.length === 0 ? (
            <EmptyState title="No tasks yet" description="Break the project into assignable work items." />
          ) : (
            <ul className="divide-y divide-concrete-100">
              {tasks.map((task) => (
                <li key={task._id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm font-semibold text-navy-900">{task.title}</p>
                    <p className="mt-0.5 text-xs text-concrete-500">
                      {employeeName(task.assignee)} · Due {formatDate(task.dueDate)}
                    </p>
                  </div>
                  <StatusBadge status={task.status} />
                  <StatusBadge status={task.priority} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "reports" && (
        <Card>
          <CardHeader
            title="Daily progress reports"
            description={client ? "Approved reports shared with you." : "Field records for this project."}
            actions={
              <Link to={`${basePath}/daily-reports`}>
                <Button variant="outline" size="sm"><LuFileText className="h-4 w-4" /> All reports</Button>
              </Link>
            }
          />
          {reports.length === 0 ? (
            <EmptyState title="No reports yet" description="Site reports appear here once filed." />
          ) : (
            <ul className="divide-y divide-concrete-100">
              {reports.map((report) => (
                <li key={report._id} className="px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-display text-sm font-semibold text-navy-900">{formatDate(report.date)}</p>
                    <StatusBadge status={report.status} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-concrete-600">{report.workCompleted}</p>
                  <p className="mt-1 text-xs text-concrete-500">
                    {report.workforce?.present ?? 0}/{report.workforce?.planned ?? 0} workers · {report.weather}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "documents" && (
        <Card>
          <CardHeader
            title="Project documents"
            description="Drawings, contracts, permits and reports. Files are private and access-checked."
            actions={
              <Link to={`${basePath}/documents?project=${id}`}>
                <Button variant="outline" size="sm"><LuPlus className="h-4 w-4" /> Manage documents</Button>
              </Link>
            }
          />
          {documents.length === 0 ? (
            <EmptyState title="No documents" description="Upload drawings or contracts from the Documents page." />
          ) : (
            <ul className="divide-y divide-concrete-100">
              {documents.map((document) => (
                <li key={document._id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm font-semibold text-navy-900">{document.name}</p>
                    <p className="text-xs text-concrete-500">{document.category} · {document.originalName}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadAuthenticated(`/document/${document._id}/download`, document.originalName || document.name)}
                  >
                    <LuDownload className="h-4 w-4" /> Download
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "milestones" && (
        <Card>
          <CardHeader
            title="Milestones"
            description="Contractual and delivery checkpoints."
            actions={
              admin ? (
                <Button variant="outline" size="sm" onClick={() => setMilestoneOpen(true)}>
                  <LuPlus className="h-4 w-4" /> Add milestone
                </Button>
              ) : null
            }
          />
          {(project.milestones ?? []).length === 0 ? (
            <EmptyState title="No milestones" description="Add the checkpoints the client expects." />
          ) : (
            <ul className="divide-y divide-concrete-100">
              {project.milestones.map((item) => (
                <li key={item._id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm font-semibold text-navy-900">{item.title}</p>
                    <p className="text-xs text-concrete-500">
                      Due {formatDate(item.dueDate)} · weight {item.weight ?? 1}
                    </p>
                  </div>
                  {admin ? (
                    <Select
                      aria-label={`Milestone status for ${item.title}`}
                      value={item.status}
                      onChange={(event) =>
                        updateMilestone({
                          id,
                          milestoneId: item._id,
                          status: event.target.value,
                        })
                      }
                      className="!w-40"
                    >
                      {["Pending", "In Progress", "Completed", "Delayed"].map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </Select>
                  ) : (
                    <StatusBadge status={item.status} />
                  )}
                  {admin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete milestone ${item.title}`}
                      onClick={() => milestoneConfirm.open({ id: item._id, title: item.title })}
                    >
                      <LuTrash2 className="h-4 w-4 text-danger-600" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Modal
        open={milestoneOpen}
        onClose={() => setMilestoneOpen(false)}
        title="Add milestone"
        footer={
          <>
            <Button variant="outline" onClick={() => setMilestoneOpen(false)}>Cancel</Button>
            <Button variant="accent" form="milestone-form" type="submit" loading={addState.isLoading}>Add milestone</Button>
          </>
        }
      >
        <form id="milestone-form" onSubmit={onAddMilestone} className="space-y-4">
          <Input
            label="Title"
            value={milestone.title}
            onChange={(event) => setMilestone({ ...milestone, title: event.target.value })}
            required
          />
          <Input
            label="Due date"
            type="date"
            value={milestone.dueDate}
            onChange={(event) => setMilestone({ ...milestone, dueDate: event.target.value })}
          />
          <Input
            label="Weight"
            type="number"
            min="0"
            max="100"
            value={milestone.weight}
            onChange={(event) => setMilestone({ ...milestone, weight: event.target.value })}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={confirm.confirmOpen}
        onCancel={confirm.close}
        onConfirm={confirm.target === "delete" ? onDelete : onArchive}
        title={confirm.target === "delete" ? "Delete this project?" : "Archive this project?"}
        description={
          confirm.target === "delete"
            ? "Deletion is only possible when no tasks, reports, expenses or invoices reference the project."
            : "The project disappears from active lists but all history is preserved."
        }
        confirmLabel={confirm.target === "delete" ? "Delete" : "Archive"}
        loading={deleteState.isLoading || archiveState.isLoading}
      >
        <p className="text-sm text-concrete-600">
          {confirm.target === "delete"
            ? "This cannot be undone. Archive instead if the project has any history."
            : "You can restore it later from the project list filters."}
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={milestoneConfirm.confirmOpen}
        onCancel={milestoneConfirm.close}
        onConfirm={onDeleteMilestone}
        title="Delete this milestone?"
        description={
          milestoneConfirm.target?.title
            ? `"${milestoneConfirm.target.title}" will be removed from the delivery schedule.`
            : "This milestone will be removed from the delivery schedule."
        }
        confirmLabel="Delete milestone"
        loading={deleteMilestoneState.isLoading}
      />
    </>
  );
};

export default ProjectDetail;

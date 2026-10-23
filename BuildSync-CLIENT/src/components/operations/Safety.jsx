import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  LuCalendarClock,
  LuHeartPulse,
  LuPlus,
  LuSearch,
  LuShieldAlert,
  LuAlertTriangle,
  LuTrash2,
} from "react-icons/lu";
import PageHeader from "../../components/ui/PageHeader";
import { Card, CardBody } from "../../components/ui/Card";
import StatCard from "../../components/ui/StatCard";
import Button from "../../components/ui/Button";
import Badge, { StatusBadge } from "../../components/ui/Badge";
import { Alert, EmptyState } from "../../components/ui/Feedback";
import { FilterChips } from "../../components/ui/Toolbar";
import { Input, Select, Textarea } from "../../components/ui/Form";
import Modal from "../../components/ui/Modal";
import ConfirmDialog, { useConfirm } from "../../components/ui/ConfirmDialog";
import { getErrorMessage } from "../../lib/api";
import { useCurrentUser } from "../../features/auth/useSession";
import {
  useCreateSafetyIncidentMutation,
  useDeleteSafetyIncidentMutation,
  useGetSafetyIncidentsQuery,
  useGetSafetySummaryQuery,
  useUpdateSafetyIncidentMutation,
} from "../../services/api/endpoints/fieldApi";
import {
  dateInput,
  formatDate,
  formatDateTime,
  projectName,
  useOperationReference,
} from "../../components/operations/shared";

const TYPES = [
  "Near Miss",
  "First Aid",
  "Lost Time Injury",
  "Property Damage",
  "Environmental",
  "Unsafe Act",
  "Unsafe Condition",
  "Other",
];

const SEVERITIES = ["Low", "Medium", "High", "Critical"];

const TRANSITIONS = {
  Open: ["Investigating", "Resolved", "Closed"],
  Investigating: ["Resolved", "Closed", "Open"],
  Resolved: ["Closed", "Investigating"],
  Closed: ["Investigating"],
};

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "Open", label: "Open" },
  { value: "Investigating", label: "Investigating" },
  { value: "Resolved", label: "Resolved" },
  { value: "Closed", label: "Closed" },
];

const SEVERITY_TONE = {
  Low: "neutral",
  Medium: "warning",
  High: "danger",
  Critical: "danger",
};

const emptyForm = () => ({
  title: "",
  site: "",
  project: "",
  date: dateInput(new Date()),
  type: "Near Miss",
  severity: "Low",
  description: "",
  peopleInvolved: "",
  immediateAction: "",
  correctiveAction: "",
  lostTimeDays: 0,
  status: "Open",
  assignedTo: "",
});

const Safety = () => {
  const { id } = useParams();
  const user = useCurrentUser();
  const admin = user?.role === "admin";

  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const confirm = useConfirm();

  const reference = useOperationReference({ projects: true, sites: admin, employees: admin });

  const { data, isLoading, error: loadError, refetch } = useGetSafetyIncidentsQuery({
    limit: 200,
    status: status || undefined,
    severity: severity || undefined,
  });
  const { data: summary } = useGetSafetySummaryQuery();

  const [createIncident, createState] = useCreateSafetyIncidentMutation();
  const [updateIncident, updateState] = useUpdateSafetyIncidentMutation();
  const [deleteIncident, deleteState] = useDeleteSafetyIncidentMutation();

  const saving = createState.isLoading || updateState.isLoading;

  const incidents = useMemo(() => {
    const list = data?.incidents ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter((incident) =>
      [incident.title, incident.description, incident.site?.dep_name, incident.reportedBy?.name, incident.type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [data, search]);

  useEffect(() => {
    if (!id) return;
    const match = (data?.incidents ?? []).find((incident) => incident._id === id);
    if (match) setDetail(match);
  }, [id, data]);

  const metrics = useMemo(
    () => ({
      open: summary?.open ?? 0,
      critical: summary?.criticalOpen ?? 0,
      month: summary?.thisMonth ?? 0,
      lost: summary?.lostTimeDays ?? 0,
    }),
    [summary]
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm(), site: admin ? reference.sites[0]?._id || "" : "" });
    setFormError("");
    setDialogOpen(true);
  };

  const openEdit = (incident) => {
    setDetail(null);
    setEditing(incident);
    setForm({
      title: incident.title || "",
      site: incident.site?._id || incident.site || "",
      project: incident.project?._id || incident.project || "",
      date: dateInput(incident.date),
      type: incident.type || "Near Miss",
      severity: incident.severity || "Low",
      description: incident.description || "",
      peopleInvolved: incident.peopleInvolved || "",
      immediateAction: incident.immediateAction || "",
      correctiveAction: incident.correctiveAction || "",
      lostTimeDays: incident.lostTimeDays ?? 0,
      status: incident.status || "Open",
      assignedTo: incident.assignedTo?._id || incident.assignedTo || "",
    });
    setFormError("");
    setDialogOpen(true);
  };

  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    if (!form.title.trim() || !form.description.trim()) {
      setFormError("A title and description are required.");
      return;
    }
    if (admin && !editing && !form.site) {
      setFormError("Choose the site where the incident happened.");
      return;
    }
    try {
      if (editing) {
        await updateIncident({
          id: editing._id,
          title: form.title.trim(),
          type: form.type,
          severity: form.severity,
          description: form.description.trim(),
          peopleInvolved: form.peopleInvolved,
          immediateAction: form.immediateAction,
          correctiveAction: form.correctiveAction,
          lostTimeDays: Number(form.lostTimeDays) || 0,
          status: form.status,
          date: form.date,
          ...(admin && form.assignedTo ? { assignedTo: form.assignedTo } : {}),
        }).unwrap();
      } else {
        await createIncident({
          title: form.title.trim(),
          ...(admin ? { site: form.site } : {}),
          project: form.project || undefined,
          date: form.date,
          type: form.type,
          severity: form.severity,
          description: form.description.trim(),
          peopleInvolved: form.peopleInvolved,
          immediateAction: form.immediateAction,
        }).unwrap();
      }
      setDialogOpen(false);
    } catch (submitError) {
      setFormError(getErrorMessage(submitError, "The incident could not be saved."));
    }
  };

  const onDelete = async () => {
    try {
      await deleteIncident(confirm.target).unwrap();
      confirm.close();
      setDetail(null);
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
      confirm.close();
    }
  };

  const allowedStatuses = editing ? [editing.status, ...(TRANSITIONS[editing.status] || [])] : ["Open"];

  return (
    <>
      <PageHeader
        title="Safety"
        description="Incidents and near misses, with corrective actions and lost-time tracking. High and critical reports alert administrators immediately."
        actions={
          <Button variant="accent" onClick={openCreate}>
            <LuPlus className="h-4 w-4" aria-hidden="true" /> Report Incident
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 sm:mb-5">
        <StatCard icon={LuShieldAlert} label="Open" value={metrics.open} tone={metrics.open ? "warning" : "success"} />
        <StatCard icon={LuAlertTriangle} label="High / critical" value={metrics.critical} tone={metrics.critical ? "danger" : "success"} />
        <StatCard icon={LuCalendarClock} label="This month" value={metrics.month} tone="navy" />
        <StatCard icon={LuHeartPulse} label="Lost time" value={`${metrics.lost}d`} hint="This month" tone={metrics.lost ? "danger" : "success"} />
      </div>

      {error && <div className="mb-4"><Alert variant="error" onDismiss={() => setError("")}>{error}</Alert></div>}

      <Card>
        <div className="flex flex-col gap-3 border-b border-concrete-200 px-4 py-3.5 sm:px-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-xs">
              <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-concrete-400" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search incidents"
                aria-label="Search safety incidents"
                className="w-full rounded-md border border-concrete-300 bg-white py-2 pl-9 pr-3 text-sm text-navy-900 placeholder:text-concrete-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-400"
              />
            </div>
            <Select value={severity} onChange={(event) => setSeverity(event.target.value)} aria-label="Filter by severity" className="sm:!w-40">
              <option value="">All severities</option>
              {SEVERITIES.map((value) => <option key={value} value={value}>{value}</option>)}
            </Select>
          </div>
          <FilterChips options={STATUS_FILTERS} value={status} onChange={setStatus} ariaLabel="Filter incidents by status" />
        </div>

        {isLoading ? (
          <CardBody><p className="py-8 text-center text-sm text-concrete-500">Loading incidents…</p></CardBody>
        ) : loadError ? (
          <EmptyState title="Could not load incidents" description={getErrorMessage(loadError)} action={<Button variant="outline" onClick={refetch}>Try again</Button>} />
        ) : incidents.length === 0 ? (
          <EmptyState icon={LuShieldAlert} title={search || status || severity ? "No matching incidents" : "No incidents reported"} description="Report a near miss or incident so it can be investigated and closed out." action={<Button variant="accent" onClick={openCreate}>Report an incident</Button>} />
        ) : (
          <ul className="divide-y divide-concrete-100">
            {incidents.map((incident) => (
              <li key={incident._id} className="flex flex-wrap items-start gap-3 px-4 py-3.5 sm:px-5">
                <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
                  ["High", "Critical"].includes(incident.severity) ? "bg-danger-50 text-danger-600" : "bg-warning-50 text-warning-700"
                }`}>
                  <LuShieldAlert className="h-5 w-5" aria-hidden="true" />
                </span>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setDetail(incident)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-sm font-semibold text-navy-900">{incident.title}</p>
                    <StatusBadge status={incident.status} />
                    <Badge tone={SEVERITY_TONE[incident.severity] || "neutral"} dot>{incident.severity}</Badge>
                    <span className="text-2xs uppercase tracking-wide text-concrete-500">{incident.type}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-concrete-600">{incident.description}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-concrete-500">
                    <span>{formatDate(incident.date)}</span>
                    <span>{incident.site?.dep_name || "Site"}</span>
                    {incident.project && <span>{projectName(incident.project)}</span>}
                    {incident.lostTimeDays > 0 && <span className="text-danger-600">{incident.lostTimeDays} lost day(s)</span>}
                    {incident.reportedBy?.name && <span>By {incident.reportedBy.name}</span>}
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => openEdit(incident)}>Update</Button>
                  {admin && incident.status === "Open" && (
                    <Button variant="ghost" size="icon" aria-label="Delete incident" onClick={() => confirm.open(incident._id)}>
                      <LuTrash2 className="h-4 w-4 text-danger-600" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Detail */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.title || "Safety incident"}
        description={detail ? `${detail.type} · ${detail.severity} · ${formatDate(detail.date)}` : undefined}
        size="lg"
        footer={
          detail ? (
            <>
              <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
              <Button variant="accent" onClick={() => openEdit(detail)}>Update incident</Button>
            </>
          ) : null
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={detail.status} />
              <Badge tone={SEVERITY_TONE[detail.severity] || "neutral"}>{detail.severity}</Badge>
            </div>
            <dl className="grid grid-cols-2 gap-3 rounded-md bg-concrete-50 p-3 text-sm sm:grid-cols-4">
              <div><dt className="text-xs text-concrete-500">Site</dt><dd className="mt-1 text-navy-900">{detail.site?.dep_name || "—"}</dd></div>
              <div><dt className="text-xs text-concrete-500">Project</dt><dd className="mt-1 text-navy-900">{projectName(detail.project)}</dd></div>
              <div><dt className="text-xs text-concrete-500">Reported by</dt><dd className="mt-1 text-navy-900">{detail.reportedBy?.name || "—"}</dd></div>
              <div><dt className="text-xs text-concrete-500">Lost time</dt><dd className="mt-1 text-navy-900">{detail.lostTimeDays || 0} day(s)</dd></div>
            </dl>
            <section><h3 className="font-display text-xs font-semibold uppercase tracking-wider text-concrete-500">What happened</h3><p className="mt-1 whitespace-pre-line text-sm text-navy-900">{detail.description}</p></section>
            {detail.peopleInvolved && <section><h3 className="font-display text-xs font-semibold uppercase tracking-wider text-concrete-500">People involved</h3><p className="mt-1 whitespace-pre-line text-sm text-navy-900">{detail.peopleInvolved}</p></section>}
            {detail.immediateAction && <section><h3 className="font-display text-xs font-semibold uppercase tracking-wider text-concrete-500">Immediate action</h3><p className="mt-1 whitespace-pre-line text-sm text-navy-900">{detail.immediateAction}</p></section>}
            {detail.correctiveAction && <section><h3 className="font-display text-xs font-semibold uppercase tracking-wider text-concrete-500">Corrective action</h3><p className="mt-1 whitespace-pre-line text-sm text-navy-900">{detail.correctiveAction}</p></section>}
            {detail.closedAt && <p className="text-xs text-concrete-500">Closed {formatDateTime(detail.closedAt)}</p>}
          </div>
        )}
      </Modal>

      {/* Create / edit */}
      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? "Update safety incident" : "Report safety incident"}
        description="Near misses are worth recording too - they prevent the next injury."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="accent" form="safety-form" type="submit" loading={saving}>
              {editing ? "Save changes" : "Report incident"}
            </Button>
          </>
        }
      >
        <form id="safety-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {formError && <div className="sm:col-span-2"><Alert variant="error">{formError}</Alert></div>}
          <div className="sm:col-span-2">
            <Input label="Title" value={form.title} onChange={update("title")} required placeholder="Short summary of the incident" />
          </div>
          <Select label="Type" value={form.type} onChange={update("type")}>
            {TYPES.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
          <Select label="Severity" value={form.severity} onChange={update("severity")}>
            {SEVERITIES.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
          <Input label="Date" type="date" value={form.date} onChange={update("date")} max={dateInput(new Date())} />
          {admin && !editing ? (
            <Select label="Site" value={form.site} onChange={update("site")} required>
              <option value="">Select site</option>
              {reference.sites.map((site) => <option key={site._id} value={site._id}>{site.dep_name}</option>)}
            </Select>
          ) : (
            <Select label="Project" value={form.project} onChange={update("project")}>
              <option value="">No project</option>
              {reference.projects.map((project) => <option key={project._id} value={project._id}>{project.code} · {projectName(project)}</option>)}
            </Select>
          )}
          {admin && !editing && (
            <Select label="Project" value={form.project} onChange={update("project")}>
              <option value="">No project</option>
              {reference.projects.map((project) => <option key={project._id} value={project._id}>{project.code} · {projectName(project)}</option>)}
            </Select>
          )}
          <div className="sm:col-span-2">
            <Textarea label="What happened" rows={3} value={form.description} onChange={update("description")} required />
          </div>
          <Textarea label="People involved" rows={2} value={form.peopleInvolved} onChange={update("peopleInvolved")} />
          <Textarea label="Immediate action taken" rows={2} value={form.immediateAction} onChange={update("immediateAction")} />

          {editing && (
            <>
              <div className="sm:col-span-2">
                <Textarea label="Corrective action" rows={2} value={form.correctiveAction} onChange={update("correctiveAction")} />
              </div>
              <Input label="Lost time days" type="number" min="0" value={form.lostTimeDays} onChange={update("lostTimeDays")} />
              <Select label="Status" value={form.status} onChange={update("status")} hint="Only valid next steps are listed">
                {allowedStatuses.map((value) => <option key={value} value={value}>{value}</option>)}
              </Select>
              {admin && (
                <Select label="Assigned to" value={form.assignedTo} onChange={update("assignedTo")}>
                  <option value="">Unassigned</option>
                  {reference.employees.map((employee) => (
                    <option key={employee._id} value={employee.userId?._id || employee._id}>{employee.userId?.name || employee.employeeId}</option>
                  ))}
                </Select>
              )}
            </>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={confirm.confirmOpen}
        onCancel={confirm.close}
        onConfirm={onDelete}
        title="Delete this incident?"
        description="Only an open incident can be deleted. Close it to keep the record."
        confirmLabel="Delete incident"
        loading={deleteState.isLoading}
      />
    </>
  );
};

export default Safety;

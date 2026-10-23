import { useEffect, useMemo, useState } from "react";
import {
  LuCalendarDays,
  LuCamera,
  LuCheckCircle2,
  LuClipboardCheck,
  LuCloudSun,
  LuFileText,
  LuPlus,
  LuSearch,
  LuSend,
  LuTrash2,
  LuUsers,
} from "react-icons/lu";
import PageHeader from "../../components/ui/PageHeader";
import { Card, CardBody } from "../../components/ui/Card";
import StatCard from "../../components/ui/StatCard";
import Button from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/Badge";
import { Alert, EmptyState } from "../../components/ui/Feedback";
import { FilterChips } from "../../components/ui/Toolbar";
import Modal from "../../components/ui/Modal";
import ConfirmDialog, { useConfirm } from "../../components/ui/ConfirmDialog";
import { Input, Select, Textarea } from "../../components/ui/Form";
import { assetUrl, getErrorMessage } from "../../lib/api";
import { useCurrentUser } from "../../features/auth/useSession";
import {
  useApproveDailyReportMutation,
  useCreateDailyReportMutation,
  useDeleteDailyReportMutation,
  useGetDailyReportsQuery,
  useGetMaterialsQuery,
  useRejectDailyReportMutation,
  useSubmitDailyReportMutation,
  useUpdateDailyReportMutation,
} from "../../services/api/endpoints/fieldApi";
import {
  dateInput,
  formatDate,
  formatDateTime,
  projectName,
  useOperationReference,
} from "../../components/operations/shared";

const WEATHER = ["Clear", "Cloudy", "Rain", "Heavy Rain", "Extreme Heat", "Wind", "Other"];

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "Draft", label: "Draft" },
  { value: "Submitted", label: "Submitted" },
  { value: "Approved", label: "Approved" },
];

const emptyForm = () => ({
  project: "",
  date: dateInput(new Date()),
  weather: "Clear",
  planned: 0,
  present: 0,
  workCompleted: "",
  issues: "",
  safetyNotes: "",
  materials: [],
  removePhotos: false,
});

const reportDate = (report) => report?.date || dateInput(report?.createdAt);
const authorId = (report) => String(report?.submittedBy?._id || report?.submittedBy || "");

const DailyReports = () => {
  const user = useCurrentUser();
  const admin = user?.role === "admin";
  const client = user?.role === "client";
  const canFile = admin || user?.role === "employee";

  const [projectFilter, setProjectFilter] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const confirm = useConfirm();

  const reference = useOperationReference({ projects: true });

  const query = useMemo(
    () => ({
      limit: 100,
      project: projectFilter || undefined,
      status: admin && status ? status : undefined,
    }),
    [admin, projectFilter, status]
  );

  const { data, isLoading, error: loadError, refetch } = useGetDailyReportsQuery(query);
  const { data: materialData } = useGetMaterialsQuery({ limit: 200 }, { skip: !canFile });
  const materials = materialData?.materials ?? [];

  const [createReport, createState] = useCreateDailyReportMutation();
  const [updateReport, updateState] = useUpdateDailyReportMutation();
  const [submitReport, submitState] = useSubmitDailyReportMutation();
  const [approveReport, approveState] = useApproveDailyReportMutation();
  const [rejectReport, rejectState] = useRejectDailyReportMutation();
  const [deleteReport, deleteState] = useDeleteDailyReportMutation();

  const saving = createState.isLoading || updateState.isLoading;

  const reports = useMemo(() => {
    const list = data?.reports ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter((report) =>
      [report.project?.name, report.project?.code, report.workCompleted, report.site?.dep_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [data, search]);

  const metrics = useMemo(() => {
    const list = data?.reports ?? [];
    return {
      total: list.length,
      submitted: list.filter((report) => report.status === "Submitted").length,
      approved: list.filter((report) => report.status === "Approved").length,
      draft: list.filter((report) => report.status === "Draft").length,
    };
  }, [data]);

  useEffect(() => {
    setViewing((current) => {
      if (!current) return current;
      return (data?.reports ?? []).find((report) => report._id === current._id) || current;
    });
  }, [data]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm(), project: projectFilter || reference.projects[0]?._id || "" });
    setPhotos([]);
    setFormError("");
    setError("");
    setDialogOpen(true);
  };

  const openEdit = (report) => {
    setViewing(null);
    setEditing(report);
    setForm({
      project: report.project?._id || report.project || "",
      date: report.date || dateInput(new Date()),
      weather: report.weather || "Clear",
      planned: report.workforce?.planned ?? 0,
      present: report.workforce?.present ?? 0,
      workCompleted: report.workCompleted || "",
      issues: report.issues || "",
      safetyNotes: report.safetyNotes || "",
      materials: (report.materialsUsed || []).map((item) => ({
        material: item.material?._id || item.material,
        quantity: item.quantity,
        unit: item.unit || item.material?.unit || "",
      })),
      removePhotos: false,
    });
    setPhotos([]);
    setFormError("");
    setError("");
    setDialogOpen(true);
  };

  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const addMaterial = () =>
    setForm((current) => ({
      ...current,
      materials: [...current.materials, { material: "", quantity: 1, unit: "" }],
    }));

  const updateMaterial = (index, field, value) =>
    setForm((current) => ({
      ...current,
      materials: current.materials.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
              ...(field === "material"
                ? { unit: materials.find((material) => material._id === value)?.unit || "" }
                : {}),
            }
          : item
      ),
    }));

  const removeMaterial = (index) =>
    setForm((current) => ({
      ...current,
      materials: current.materials.filter((_, itemIndex) => itemIndex !== index),
    }));

  const buildFormData = () => {
    const payload = new FormData();
    payload.append("project", form.project);
    payload.append("date", form.date);
    payload.append("weather", form.weather);
    payload.append(
      "workforce",
      JSON.stringify({
        planned: Number(form.planned) || 0,
        present: Number(form.present) || 0,
      })
    );
    payload.append("workCompleted", form.workCompleted.trim());
    payload.append("issues", form.issues || "");
    payload.append("safetyNotes", form.safetyNotes || "");
    payload.append(
      "materialsUsed",
      JSON.stringify(
        form.materials
          .filter((item) => item.material && Number(item.quantity) > 0)
          .map((item) => ({ material: item.material, quantity: Number(item.quantity), unit: item.unit }))
      )
    );
    if (form.removePhotos) payload.append("removePhotos", "true");
    photos.forEach((file) => payload.append("photos", file));
    return payload;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    if (!form.project) {
      setFormError("Choose the project this report belongs to.");
      return;
    }
    if (!form.workCompleted.trim()) {
      setFormError("Describe the work completed on site.");
      return;
    }
    try {
      const payload = buildFormData();
      if (editing) {
        await updateReport({ id: editing._id, formData: payload }).unwrap();
      } else {
        await createReport(payload).unwrap();
      }
      setDialogOpen(false);
      setEditing(null);
    } catch (submitError) {
      setFormError(getErrorMessage(submitError, "The daily report could not be saved."));
    }
  };

  const runAction = async (action, report) => {
    setError("");
    try {
      await action(report._id).unwrap();
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    }
  };

  const onReject = async () => {
    if (!rejectReason.trim()) return;
    try {
      await rejectReport({ id: rejecting._id, reason: rejectReason.trim() }).unwrap();
      setRejecting(null);
      setRejectReason("");
    } catch (rejectError) {
      setError(getErrorMessage(rejectError));
      setRejecting(null);
    }
  };

  const onDelete = async () => {
    try {
      await deleteReport(confirm.target).unwrap();
      confirm.close();
      setViewing(null);
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
      confirm.close();
    }
  };

  const ownsReport = (report) => admin || authorId(report) === String(user?._id);
  const canEdit = (report) => report.status !== "Approved" && ownsReport(report);
  const canSubmit = (report) => report.status === "Draft" && ownsReport(report);
  const canDelete = (report) => report.status !== "Approved" && ownsReport(report);

  return (
    <>
      <PageHeader
        title={client ? "Site Reports" : "Daily Reports"}
        description={
          client
            ? "Approved progress reports shared by your contractor."
            : "Record what happened on site today. Approval posts material usage to the stock ledger exactly once."
        }
        actions={
          canFile ? (
            <Button variant="accent" onClick={openCreate}>
              <LuPlus className="h-4 w-4" aria-hidden="true" /> New Report
            </Button>
          ) : null
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 sm:mb-5">
        <StatCard icon={LuFileText} label="Reports" value={metrics.total} tone="navy" />
        <StatCard icon={LuSend} label="Awaiting approval" value={metrics.submitted} tone="warning" />
        <StatCard icon={LuCheckCircle2} label="Approved" value={metrics.approved} tone="success" />
        <StatCard icon={LuClipboardCheck} label="Drafts" value={metrics.draft} tone="accent" />
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
                placeholder="Search reports"
                aria-label="Search daily reports"
                className="w-full rounded-md border border-concrete-300 bg-white py-2 pl-9 pr-3 text-sm text-navy-900 placeholder:text-concrete-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-400"
              />
            </div>
            <Select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} aria-label="Filter by project" className="sm:!w-56">
              <option value="">All projects</option>
              {reference.projects.map((project) => (
                <option key={project._id} value={project._id}>{projectName(project)}</option>
              ))}
            </Select>
          </div>
          {!client && <FilterChips options={STATUS_FILTERS} value={status} onChange={setStatus} ariaLabel="Filter reports by status" />}
        </div>

        {isLoading ? (
          <CardBody><p className="py-8 text-center text-sm text-concrete-500">Loading reports…</p></CardBody>
        ) : loadError ? (
          <EmptyState
            title="Could not load daily reports"
            description={getErrorMessage(loadError)}
            action={<Button variant="outline" onClick={refetch}>Try again</Button>}
          />
        ) : reports.length === 0 ? (
          <EmptyState
            icon={LuCalendarDays}
            title={search || status ? "No matching reports" : "No daily reports yet"}
            description={
              canFile
                ? "File today's progress report to keep the site record current."
                : "Approved reports will appear here as soon as they are shared."
            }
            action={canFile ? <Button variant="accent" onClick={openCreate}>File a report</Button> : null}
          />
        ) : (
          <ul className="divide-y divide-concrete-100">
            {reports.map((report) => (
              <li key={report._id} className="px-4 py-3.5 sm:px-5">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                  <button type="button" onClick={() => setViewing(report)} className="min-w-0 flex-1 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-sm font-semibold leading-snug text-navy-900">
                        {formatDate(reportDate(report))} · {projectName(report.project)}
                      </p>
                      <StatusBadge status={report.status} />
                      {report.workforce?.present > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-concrete-500">
                          <LuUsers className="h-3.5 w-3.5" aria-hidden="true" />
                          {report.workforce.present} present
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-concrete-600">{report.workCompleted}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-concrete-500">
                      <span>{report.site?.dep_name || "No site"}</span>
                      <span className="inline-flex items-center gap-1">
                        <LuCloudSun className="h-3.5 w-3.5" aria-hidden="true" /> {report.weather}
                      </span>
                      {report.materialsUsed?.length > 0 && <span>{report.materialsUsed.length} material line(s)</span>}
                      {report.photos?.length > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <LuCamera className="h-3.5 w-3.5" aria-hidden="true" /> {report.photos.length}
                        </span>
                      )}
                      {report.submittedBy?.name && <span>By {report.submittedBy.name}</span>}
                    </div>
                  </button>
                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    {canEdit(report) && (
                      <Button variant="outline" size="sm" onClick={() => openEdit(report)}>Edit</Button>
                    )}
                    {canSubmit(report) && (
                      <Button variant="accent" size="sm" loading={submitState.isLoading} onClick={() => runAction(submitReport, report)}>
                        Submit
                      </Button>
                    )}
                    {admin && report.status === "Submitted" && (
                      <>
                        <Button variant="primary" size="sm" loading={approveState.isLoading} onClick={() => runAction(approveReport, report)}>
                          Approve
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setRejecting(report); setRejectReason(""); }}>
                          Return
                        </Button>
                      </>
                    )}
                    {canDelete(report) && (
                      <Button variant="ghost" size="icon" aria-label="Delete report" onClick={() => confirm.open(report._id)}>
                        <LuTrash2 className="h-4 w-4 text-danger-600" />
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Read-only detail */}
      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing ? `${formatDate(reportDate(viewing))} · ${projectName(viewing.project)}` : "Daily report"}
        description={viewing ? `${viewing.site?.dep_name || "Site"} · ${viewing.weather}` : undefined}
        size="lg"
        footer={
          viewing ? (
            <>
              {canEdit(viewing) && <Button variant="outline" onClick={() => openEdit(viewing)}>Edit report</Button>}
              {canSubmit(viewing) && (
                <Button variant="accent" loading={submitState.isLoading} onClick={() => runAction(submitReport, viewing)}>
                  Submit for approval
                </Button>
              )}
              {admin && viewing.status === "Submitted" && (
                <>
                  <Button variant="outline" onClick={() => { setViewing(null); setRejecting(viewing); setRejectReason(""); }}>
                    Return
                  </Button>
                  <Button variant="primary" loading={approveState.isLoading} onClick={() => runAction(approveReport, viewing)}>
                    Approve report
                  </Button>
                </>
              )}
            </>
          ) : null
        }
      >
        {viewing && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={viewing.status} />
              {viewing.stockApplied && <span className="text-xs text-success-700">Material usage posted to stock</span>}
            </div>
            <dl className="grid grid-cols-2 gap-4 rounded-md bg-concrete-50 p-3 text-sm sm:grid-cols-4">
              <div><dt className="text-xs text-concrete-500">Workforce</dt><dd className="mt-1 font-semibold text-navy-900">{viewing.workforce?.present || 0} / {viewing.workforce?.planned || 0}</dd></div>
              <div><dt className="text-xs text-concrete-500">Submitted</dt><dd className="mt-1 text-navy-900">{viewing.submittedAt ? formatDateTime(viewing.submittedAt) : "Not yet"}</dd></div>
              <div><dt className="text-xs text-concrete-500">Approved</dt><dd className="mt-1 text-navy-900">{viewing.approvedAt ? formatDateTime(viewing.approvedAt) : "—"}</dd></div>
              <div><dt className="text-xs text-concrete-500">Filed by</dt><dd className="mt-1 text-navy-900">{viewing.submittedBy?.name || "—"}</dd></div>
            </dl>
            {viewing.rejectionReason && <Alert variant="warning">Returned for correction: {viewing.rejectionReason}</Alert>}
            <section>
              <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-concrete-500">Work completed</h3>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-navy-900">{viewing.workCompleted}</p>
            </section>
            {viewing.issues && (
              <section><h3 className="font-display text-xs font-semibold uppercase tracking-wider text-concrete-500">Issues</h3><p className="mt-1 whitespace-pre-line text-sm text-navy-900">{viewing.issues}</p></section>
            )}
            {viewing.safetyNotes && (
              <section><h3 className="font-display text-xs font-semibold uppercase tracking-wider text-concrete-500">Safety notes</h3><p className="mt-1 whitespace-pre-line text-sm text-navy-900">{viewing.safetyNotes}</p></section>
            )}
            {viewing.materialsUsed?.length > 0 && (
              <section>
                <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-concrete-500">Materials consumed</h3>
                <ul className="mt-1 divide-y divide-concrete-100 rounded-md border border-concrete-200">
                  {viewing.materialsUsed.map((item, index) => (
                    <li key={index} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0 break-words text-navy-900">{item.material?.name || "Material"}</span>
                      <span className="shrink-0 tabular-nums text-concrete-600">{item.quantity} {item.unit || item.material?.unit}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {viewing.photos?.length > 0 && (
              <section>
                <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-concrete-500">Site photos</h3>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {viewing.photos.map((photo) => (
                    <a
                      key={photo}
                      href={assetUrl(`reports/${photo}`)}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-md border border-concrete-200"
                    >
                      <img
                        src={assetUrl(`reports/${photo}`)}
                        alt="Site progress"
                        loading="lazy"
                        className="h-28 w-full object-cover transition-transform duration-200 hover:scale-105"
                      />
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </Modal>

      {/* Create / edit */}
      <Modal
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        title={editing ? "Edit daily report" : "New daily report"}
        description="One report per project per business date."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditing(null); }}>Cancel</Button>
            <Button variant="accent" form="daily-report-form" type="submit" loading={saving}>
              {editing ? "Save changes" : "Save draft"}
            </Button>
          </>
        }
      >
        <form id="daily-report-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {formError && <div className="sm:col-span-2"><Alert variant="error">{formError}</Alert></div>}
          <Select label="Project" value={form.project} onChange={update("project")} required disabled={Boolean(editing)}>
            <option value="">Select a project</option>
            {reference.projects.map((project) => (
              <option key={project._id} value={project._id}>{project.code} · {projectName(project)}</option>
            ))}
          </Select>
          <Input label="Report date" type="date" value={form.date} onChange={update("date")} max={dateInput(new Date())} required disabled={Boolean(editing)} />
          <Select label="Weather" value={form.weather} onChange={update("weather")}>
            {WEATHER.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Planned" type="number" min="0" value={form.planned} onChange={update("planned")} />
            <Input label="Present" type="number" min="0" value={form.present} onChange={update("present")} />
          </div>
          <div className="sm:col-span-2">
            <Textarea label="Work completed" rows={4} value={form.workCompleted} onChange={update("workCompleted")} required placeholder="Describe the activities completed, locations and quantities." />
          </div>
          <Textarea label="Issues / delays" rows={2} value={form.issues} onChange={update("issues")} />
          <Textarea label="Safety notes" rows={2} value={form.safetyNotes} onChange={update("safetyNotes")} />

          <div className="sm:col-span-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-display text-xs font-semibold uppercase tracking-wider text-navy-700">Materials consumed</p>
              <Button variant="outline" size="sm" onClick={addMaterial}>Add material</Button>
            </div>
            {form.materials.length === 0 ? (
              <p className="rounded-md border border-dashed border-concrete-300 px-3 py-3 text-xs text-concrete-500">
                No material lines. Approved usage is deducted from site stock automatically.
              </p>
            ) : (
              <ul className="space-y-2">
                {form.materials.map((item, index) => (
                  <li key={index} className="grid grid-cols-[1fr_6rem_auto] items-end gap-2">
                    <Select aria-label="Material" value={item.material} onChange={(event) => updateMaterial(index, "material", event.target.value)}>
                      <option value="">Select material</option>
                      {materials.map((material) => (
                        <option key={material._id} value={material._id}>{material.sku} · {material.name}</option>
                      ))}
                    </Select>
                    <Input aria-label="Quantity" type="number" min="0" step="0.01" value={item.quantity} onChange={(event) => updateMaterial(index, "quantity", event.target.value)} />
                    <Button variant="ghost" size="icon" aria-label="Remove material line" onClick={() => removeMaterial(index)}>
                      <LuTrash2 className="h-4 w-4 text-danger-600" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="report-photos" className="mb-1.5 block font-display text-xs font-semibold uppercase tracking-wider text-navy-700">
              Site photos <span className="font-normal normal-case tracking-normal text-concrete-500">(up to 6)</span>
            </label>
            <input
              id="report-photos"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => setPhotos(Array.from(event.target.files || []).slice(0, 6))}
              className="block w-full cursor-pointer rounded-md border border-concrete-300 bg-white px-3 py-2 text-sm text-navy-900 file:mr-3 file:rounded file:border-0 file:bg-concrete-100 file:px-3 file:py-1.5 file:font-display file:text-xs file:font-semibold file:uppercase file:tracking-wide file:text-navy-800"
            />
            {photos.length > 0 && <p className="mt-1 text-xs text-concrete-500">{photos.length} new photo(s) ready to upload.</p>}
            {editing?.photos?.length > 0 && (
              <label className="mt-2 flex items-center gap-2 text-xs text-concrete-600">
                <input
                  type="checkbox"
                  checked={form.removePhotos}
                  onChange={(event) => setForm((current) => ({ ...current, removePhotos: event.target.checked }))}
                  className="h-4 w-4 rounded border-concrete-300 accent-navy-900"
                />
                Replace the {editing.photos.length} existing photo(s)
              </label>
            )}
          </div>
        </form>
      </Modal>

      {/* Return for correction */}
      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title="Return report for correction"
        description="The report goes back to the author as a draft."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="danger" onClick={onReject} loading={rejectState.isLoading} disabled={!rejectReason.trim()}>
              Return report
            </Button>
          </>
        }
      >
        <label htmlFor="reject-reason" className="mb-1.5 block font-display text-xs font-semibold uppercase tracking-wider text-navy-700">
          Reason
        </label>
        <textarea
          id="reject-reason"
          rows={3}
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
          className="block w-full rounded-md border border-concrete-300 px-3 py-2 text-sm text-navy-900 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-400"
          placeholder="What needs to be corrected?"
        />
      </Modal>

      <ConfirmDialog
        open={confirm.confirmOpen}
        onCancel={confirm.close}
        onConfirm={onDelete}
        title="Delete this daily report?"
        description="The draft report and its material lines will be removed. Approved reports are permanent."
        confirmLabel="Delete report"
        loading={deleteState.isLoading}
      />
    </>
  );
};

export default DailyReports;

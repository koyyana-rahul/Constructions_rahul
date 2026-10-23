import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  LuCalendarClock,
  LuGauge,
  LuPlus,
  LuSearch,
  LuTruck,
  LuWrench,
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
import { formatINR, formatINRCompact } from "../../utils/format";
import { useCurrentUser } from "../../features/auth/useSession";
import {
  useCreateEquipmentMutation,
  useGetEquipmentQuery,
  useGetEquipmentSummaryQuery,
  useRetireEquipmentMutation,
  useUpdateEquipmentMutation,
} from "../../services/api/endpoints/fieldApi";
import {
  dateInput,
  daysUntil,
  employeeName,
  formatDate,
  projectName,
  useOperationReference,
} from "../../components/operations/shared";

const CATEGORIES = ["Earthmoving", "Lifting", "Concrete", "Compaction", "Power", "Transport", "Survey", "Safety", "Other"];
const STATUSES = ["Available", "In Use", "Maintenance", "Breakdown", "Retired"];

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "Available", label: "Available" },
  { value: "In Use", label: "In Use" },
  { value: "Maintenance", label: "Maintenance" },
  { value: "Breakdown", label: "Breakdown" },
];

const EMPTY = {
  code: "",
  name: "",
  category: "Other",
  ownership: "Owned",
  site: "",
  project: "",
  status: "Available",
  dailyRate: 0,
  hourlyRate: 0,
  purchaseDate: "",
  purchaseCost: 0,
  lastMaintenance: "",
  nextMaintenance: "",
  operator: "",
  vendor: "",
  notes: "",
};

const Equipment = () => {
  const { id } = useParams();
  const user = useCurrentUser();
  const admin = user?.role === "admin";

  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const confirm = useConfirm();

  const reference = useOperationReference({ projects: true, sites: admin, employees: admin, vendors: admin });

  const { data, isLoading, error: loadError, refetch } = useGetEquipmentQuery({
    limit: 200,
    status: status || undefined,
  });
  const { data: summary } = useGetEquipmentSummaryQuery();

  const [createEquipment, createState] = useCreateEquipmentMutation();
  const [updateEquipment, updateState] = useUpdateEquipmentMutation();
  const [retireEquipment, retireState] = useRetireEquipmentMutation();

  const saving = createState.isLoading || updateState.isLoading;

  const equipment = useMemo(() => {
    const list = data?.equipment ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter((item) =>
      [item.code, item.name, item.category, item.site?.dep_name, projectName(item.project)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [data, search]);

  useEffect(() => {
    if (!id) return;
    const match = (data?.equipment ?? []).find((item) => item._id === id);
    if (match) setDetail(match);
  }, [id, data]);

  const metrics = useMemo(
    () => ({
      total: summary?.total ?? 0,
      inUse: summary?.byStatus?.["In Use"] ?? 0,
      maintenance: summary?.maintenanceDue ?? 0,
      utilization: summary?.utilization ?? 0,
      rental: summary?.rentalValue ?? 0,
    }),
    [summary]
  );

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setFormError("");
    setDialogOpen(true);
  };

  const openEdit = (item) => {
    setDetail(null);
    setEditing(item);
    setForm({
      code: item.code || "",
      name: item.name || "",
      category: item.category || "Other",
      ownership: item.ownership || "Owned",
      site: item.site?._id || item.site || "",
      project: item.project?._id || item.project || "",
      status: item.status || "Available",
      dailyRate: item.dailyRate ?? 0,
      hourlyRate: item.hourlyRate ?? 0,
      purchaseDate: dateInput(item.purchaseDate),
      purchaseCost: item.purchaseCost ?? 0,
      lastMaintenance: dateInput(item.lastMaintenance),
      nextMaintenance: dateInput(item.nextMaintenance),
      operator: item.operator?._id || item.operator || "",
      vendor: item.vendor?._id || item.vendor || "",
      notes: item.notes || "",
    });
    setFormError("");
    setDialogOpen(true);
  };

  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    if (!form.code.trim() || !form.name.trim()) {
      setFormError("A code and name are required.");
      return;
    }
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      category: form.category,
      ownership: form.ownership,
      site: form.site || null,
      project: form.project || null,
      status: form.status,
      dailyRate: Number(form.dailyRate) || 0,
      hourlyRate: Number(form.hourlyRate) || 0,
      purchaseDate: form.purchaseDate || null,
      purchaseCost: Number(form.purchaseCost) || 0,
      lastMaintenance: form.lastMaintenance || null,
      nextMaintenance: form.nextMaintenance || null,
      operator: form.operator || null,
      vendor: form.vendor || null,
      notes: form.notes,
    };
    try {
      if (editing) {
        await updateEquipment({ id: editing._id, ...payload }).unwrap();
      } else {
        await createEquipment(payload).unwrap();
      }
      setDialogOpen(false);
    } catch (submitError) {
      setFormError(getErrorMessage(submitError, "The equipment record could not be saved."));
    }
  };

  const onRetire = async () => {
    try {
      await retireEquipment(confirm.target).unwrap();
      confirm.close();
      setDetail(null);
    } catch (retireError) {
      setError(getErrorMessage(retireError));
      confirm.close();
    }
  };

  return (
    <>
      <PageHeader
        title="Equipment"
        description="Plant, machinery and tools allocated to sites, with maintenance dates and utilisation."
        actions={
          admin ? (
            <Button variant="accent" onClick={openCreate}>
              <LuPlus className="h-4 w-4" aria-hidden="true" /> New Equipment
            </Button>
          ) : null
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 sm:mb-5">
        <StatCard icon={LuTruck} label="Registered" value={metrics.total} tone="navy" />
        <StatCard icon={LuGauge} label="In use" value={`${metrics.utilization}%`} hint={`${metrics.inUse} unit(s)`} tone="accent" />
        <StatCard icon={LuWrench} label="Maintenance due" value={metrics.maintenance} hint="Within 14 days" tone={metrics.maintenance ? "warning" : "success"} />
        {admin && <StatCard icon={LuCalendarClock} label="Daily rental" value={formatINRCompact(metrics.rental)} tone="navy" />}
      </div>

      {error && <div className="mb-4"><Alert variant="error" onDismiss={() => setError("")}>{error}</Alert></div>}

      <Card>
        <div className="flex flex-col gap-3 border-b border-concrete-200 px-4 py-3.5 sm:px-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-concrete-400" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search equipment"
              aria-label="Search equipment"
              className="w-full rounded-md border border-concrete-300 bg-white py-2 pl-9 pr-3 text-sm text-navy-900 placeholder:text-concrete-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-400"
            />
          </div>
          <FilterChips options={STATUS_FILTERS} value={status} onChange={setStatus} ariaLabel="Filter equipment by status" />
        </div>

        {isLoading ? (
          <CardBody><p className="py-8 text-center text-sm text-concrete-500">Loading equipment…</p></CardBody>
        ) : loadError ? (
          <EmptyState title="Could not load equipment" description={getErrorMessage(loadError)} action={<Button variant="outline" onClick={refetch}>Try again</Button>} />
        ) : equipment.length === 0 ? (
          <EmptyState icon={LuTruck} title={search || status ? "No matching equipment" : "No equipment registered"} description={admin ? "Add the plant and tools your sites operate." : "Equipment allocated to your site will appear here."} action={admin ? <Button variant="accent" onClick={openCreate}>Add equipment</Button> : null} />
        ) : (
          <ul className="divide-y divide-concrete-100">
            {equipment.map((item) => {
              const remaining = daysUntil(item.nextMaintenance);
              return (
                <li key={item._id} className="flex flex-wrap items-start gap-3 px-4 py-3.5 sm:px-5">
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-navy-50 text-navy-700">
                    <LuTruck className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setDetail(item)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-sm font-semibold text-navy-900">{item.name}</p>
                      <StatusBadge status={item.status} />
                      <Badge tone="neutral">{item.category}</Badge>
                      {remaining !== null && remaining <= 14 && item.status !== "Retired" && (
                        <Badge tone={remaining < 0 ? "danger" : "warning"} dot>
                          {remaining < 0 ? "Maintenance overdue" : `Service in ${remaining}d`}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-concrete-500">
                      <span>{item.code}</span>
                      <span>{item.ownership}</span>
                      {item.site?.dep_name && <span>{item.site.dep_name}</span>}
                      {item.project && <span>{projectName(item.project)}</span>}
                      {item.operator && <span>{employeeName(item.operator)}</span>}
                      {item.nextMaintenance && <span>Next service {formatDate(item.nextMaintenance)}</span>}
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    {admin && item.status !== "Retired" && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => openEdit(item)}>Edit</Button>
                        <Button variant="ghost" size="sm" onClick={() => confirm.open(item._id)}>Retire</Button>
                      </>
                    )}
                    {!admin && <Button variant="outline" size="sm" onClick={() => setDetail(item)}>Details</Button>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Detail */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.name || "Equipment"}
        description={detail ? `${detail.code} · ${detail.category}` : undefined}
        size="lg"
        footer={
          detail ? (
            <>
              <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
              {admin && detail.status !== "Retired" && (
                <Button variant="accent" onClick={() => openEdit(detail)}>Edit equipment</Button>
              )}
            </>
          ) : null
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={detail.status} />
              <Badge tone="neutral">{detail.ownership}</Badge>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-concrete-500">Site</dt><dd className="mt-1 text-navy-900">{detail.site?.dep_name || "—"}</dd></div>
              <div><dt className="text-xs text-concrete-500">Project</dt><dd className="mt-1 text-navy-900">{projectName(detail.project)}</dd></div>
              <div><dt className="text-xs text-concrete-500">Operator</dt><dd className="mt-1 text-navy-900">{employeeName(detail.operator)}</dd></div>
              <div><dt className="text-xs text-concrete-500">Vendor</dt><dd className="mt-1 text-navy-900">{detail.vendor?.name || "—"}</dd></div>
              <div><dt className="text-xs text-concrete-500">Last service</dt><dd className="mt-1 text-navy-900">{formatDate(detail.lastMaintenance)}</dd></div>
              <div><dt className="text-xs text-concrete-500">Next service</dt><dd className="mt-1 text-navy-900">{formatDate(detail.nextMaintenance)}</dd></div>
              {admin && (
                <>
                  <div><dt className="text-xs text-concrete-500">Daily rate</dt><dd className="mt-1 text-navy-900">{formatINR(detail.dailyRate)}</dd></div>
                  <div><dt className="text-xs text-concrete-500">Hourly rate</dt><dd className="mt-1 text-navy-900">{formatINR(detail.hourlyRate)}</dd></div>
                  <div><dt className="text-xs text-concrete-500">Purchase cost</dt><dd className="mt-1 text-navy-900">{formatINR(detail.purchaseCost)}</dd></div>
                </>
              )}
            </dl>
            {detail.notes && <p className="rounded-md bg-concrete-50 p-3 text-sm text-concrete-600">{detail.notes}</p>}
          </div>
        )}
      </Modal>

      {/* Create / edit */}
      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? "Edit equipment" : "New equipment"}
        description="Rates and purchase costs stay hidden from field staff."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="accent" form="equipment-form" type="submit" loading={saving}>
              {editing ? "Save changes" : "Add equipment"}
            </Button>
          </>
        }
      >
        <form id="equipment-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {formError && <div className="sm:col-span-2"><Alert variant="error">{formError}</Alert></div>}
          <Input label="Equipment code" value={form.code} onChange={update("code")} required disabled={Boolean(editing)} />
          <Input label="Name" value={form.name} onChange={update("name")} required />
          <Select label="Category" value={form.category} onChange={update("category")}>
            {CATEGORIES.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
          <Select label="Ownership" value={form.ownership} onChange={update("ownership")}>
            {["Owned", "Rented"].map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
          <Select label="Status" value={form.status} onChange={update("status")}>
            {STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
          <Select label="Site" value={form.site} onChange={update("site")}>
            <option value="">Unassigned</option>
            {reference.sites.map((site) => <option key={site._id} value={site._id}>{site.dep_name}</option>)}
          </Select>
          <Select label="Project" value={form.project} onChange={update("project")}>
            <option value="">No project</option>
            {reference.projects.map((project) => <option key={project._id} value={project._id}>{project.code} · {projectName(project)}</option>)}
          </Select>
          <Select label="Operator" value={form.operator} onChange={update("operator")}>
            <option value="">Unassigned</option>
            {reference.employees.map((employee) => (
              <option key={employee._id} value={employee._id}>{employeeName(employee)}</option>
            ))}
          </Select>
          <Select label="Vendor" value={form.vendor} onChange={update("vendor")}>
            <option value="">No vendor</option>
            {reference.vendors.map((vendor) => <option key={vendor._id} value={vendor._id}>{vendor.name}</option>)}
          </Select>
          <Input label="Daily rate (₹)" type="number" min="0" step="0.01" value={form.dailyRate} onChange={update("dailyRate")} />
          <Input label="Hourly rate (₹)" type="number" min="0" step="0.01" value={form.hourlyRate} onChange={update("hourlyRate")} />
          <Input label="Purchase date" type="date" value={form.purchaseDate} onChange={update("purchaseDate")} />
          <Input label="Purchase cost (₹)" type="number" min="0" step="0.01" value={form.purchaseCost} onChange={update("purchaseCost")} />
          <Input label="Last maintenance" type="date" value={form.lastMaintenance} onChange={update("lastMaintenance")} />
          <Input label="Next maintenance" type="date" value={form.nextMaintenance} onChange={update("nextMaintenance")} />
          <div className="sm:col-span-2">
            <Textarea label="Notes" rows={2} value={form.notes} onChange={update("notes")} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirm.confirmOpen}
        onCancel={confirm.close}
        onConfirm={onRetire}
        title="Retire this equipment?"
        description="It leaves the active register but its history is preserved. Equipment in use must be returned first."
        confirmLabel="Retire equipment"
        variant="warning"
        loading={retireState.isLoading}
      />
    </>
  );
};

export default Equipment;

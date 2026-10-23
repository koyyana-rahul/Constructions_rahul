import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  LuArrowDownToLine,
  LuArrowUpFromLine,
  LuBoxes,
  LuHistory,
  LuPackage,
  LuPackagePlus,
  LuPlus,
  LuSearch,
  LuAlertTriangle,
  LuWarehouse,
} from "react-icons/lu";
import PageHeader from "../../components/ui/PageHeader";
import { Card, CardBody } from "../../components/ui/Card";
import StatCard from "../../components/ui/StatCard";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { Alert, EmptyState } from "../../components/ui/Feedback";
import { Input, Select, Textarea } from "../../components/ui/Form";
import Modal from "../../components/ui/Modal";
import ConfirmDialog, { useConfirm } from "../../components/ui/ConfirmDialog";
import { getErrorMessage } from "../../lib/api";
import { formatINR, formatINRCompact } from "../../utils/format";
import { useCurrentUser } from "../../features/auth/useSession";
import {
  useArchiveMaterialMutation,
  useCreateMaterialMutation,
  useCreateMovementMutation,
  useGetLowStockQuery,
  useGetMaterialStockQuery,
  useGetMaterialsQuery,
  useGetMovementsQuery,
  useGetStockQuery,
  useUpdateMaterialMutation,
} from "../../services/api/endpoints/fieldApi";
import {
  dateInput,
  formatDate,
  formatDateTime,
  useOperationReference,
} from "../../components/operations/shared";

const MATERIAL_CATEGORIES = [
  "Concrete",
  "Steel",
  "Masonry",
  "Plumbing",
  "Electrical",
  "Finishes",
  "Timber",
  "Hardware",
  "Safety",
  "Other",
];

const MOVEMENT_TYPES = ["In", "Out", "Adjustment"];

const TABS = [
  { key: "stock", label: "Site stock", icon: LuWarehouse },
  { key: "catalogue", label: "Catalogue", icon: LuPackage },
  { key: "movements", label: "Movements", icon: LuHistory },
];

const MOVEMENT_FILTERS = [
  { value: "", label: "All" },
  { value: "In", label: "In" },
  { value: "Out", label: "Out" },
  { value: "Adjustment", label: "Adjustment" },
];

const EMPTY_MATERIAL = {
  sku: "",
  name: "",
  category: "Other",
  unit: "Piece",
  unitCost: 0,
  reorderLevel: 0,
  preferredVendor: "",
  description: "",
  isActive: true,
};

const emptyMovement = () => ({
  material: "",
  site: "",
  type: "In",
  quantity: 1,
  unitCost: 0,
  reference: "",
  note: "",
  date: dateInput(new Date()),
});

const movementTone = (type) => {
  if (type === "In") return "success";
  if (type === "Out") return "warning";
  return "info";
};

const Inventory = () => {
  const { id: routeMaterialId } = useParams();
  const user = useCurrentUser();
  const admin = user?.role === "admin";

  const [tab, setTab] = useState("stock");
  const [siteId, setSiteId] = useState("");
  const [search, setSearch] = useState("");
  const [movementTypeFilter, setMovementTypeFilter] = useState("");
  const [materialDialog, setMaterialDialog] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [materialForm, setMaterialForm] = useState(EMPTY_MATERIAL);
  const [movementDialog, setMovementDialog] = useState(false);
  const [movementForm, setMovementForm] = useState(emptyMovement);
  const [detailId, setDetailId] = useState(routeMaterialId || null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [movementError, setMovementError] = useState("");
  const confirm = useConfirm();

  const reference = useOperationReference({ sites: true, vendors: admin });

  useEffect(() => {
    if (!admin || siteId || reference.sites.length === 0) return;
    setSiteId(reference.sites[0]._id);
  }, [admin, reference.sites, siteId]);

  useEffect(() => {
    if (routeMaterialId) setDetailId(routeMaterialId);
  }, [routeMaterialId]);

  const stockQuery = useGetStockQuery(
    { site: siteId || undefined },
    { skip: admin && !siteId }
  );
  const catalogueQuery = useGetMaterialsQuery(
    { limit: 200, site: siteId || undefined },
    { skip: admin && !siteId }
  );
  const movementsQuery = useGetMovementsQuery(
    { limit: 100, site: siteId || undefined, type: movementTypeFilter || undefined },
    { skip: admin && !siteId }
  );
  const lowStockQuery = useGetLowStockQuery(
    { site: siteId || undefined },
    { skip: admin && !siteId }
  );
  const detailQuery = useGetMaterialStockQuery(
    { id: detailId, site: siteId || undefined },
    { skip: !detailId || (admin && !siteId) }
  );

  const [createMaterial, createState] = useCreateMaterialMutation();
  const [updateMaterial, updateState] = useUpdateMaterialMutation();
  const [archiveMaterial, archiveState] = useArchiveMaterialMutation();
  const [createMovement, movementState] = useCreateMovementMutation();

  const materialSaving = createState.isLoading || updateState.isLoading;

  const stock = useMemo(() => stockQuery.data?.stock ?? [], [stockQuery.data]);
  const site = stockQuery.data?.site ?? null;
  const summary = stockQuery.data?.summary ?? null;
  const catalogue = catalogueQuery.data?.materials ?? [];
  const movements = movementsQuery.data?.movements ?? [];
  const lowStock = lowStockQuery.data ?? [];

  const term = search.trim().toLowerCase();
  const filteredStock = useMemo(
    () =>
      stock.filter((row) =>
        !term ||
        [row.name, row.sku, row.category].filter(Boolean).some((value) =>
          String(value).toLowerCase().includes(term)
        )
      ),
    [stock, term]
  );
  const filteredCatalogue = useMemo(
    () =>
      catalogue.filter((row) =>
        !term ||
        [row.name, row.sku, row.category].filter(Boolean).some((value) =>
          String(value).toLowerCase().includes(term)
        )
      ),
    [catalogue, term]
  );

  const metrics = useMemo(
    () => ({
      materials: summary?.materials ?? stock.length,
      low: summary?.lowStock ?? 0,
      out: summary?.outOfStock ?? 0,
      value: summary?.stockValue ?? 0,
    }),
    [summary, stock.length]
  );

  const resetMaterialError = () => setFormError("");

  const openCreateMaterial = () => {
    setEditingMaterial(null);
    setMaterialForm(EMPTY_MATERIAL);
    resetMaterialError();
    setMaterialDialog(true);
  };

  const openEditMaterial = (material) => {
    setEditingMaterial(material);
    setMaterialForm({
      sku: material.sku || "",
      name: material.name || "",
      category: material.category || "Other",
      unit: material.unit || "Piece",
      unitCost: material.unitCost ?? 0,
      reorderLevel: material.reorderLevel ?? 0,
      preferredVendor: material.preferredVendor?._id || material.preferredVendor || "",
      description: material.description || "",
      isActive: material.isActive !== false,
    });
    resetMaterialError();
    setMaterialDialog(true);
  };

  const updateMaterialField = (field) => (event) =>
    setMaterialForm((current) => ({
      ...current,
      [field]: field === "isActive" ? event.target.checked : event.target.value,
    }));

  const onSaveMaterial = async (event) => {
    event.preventDefault();
    setFormError("");
    if (!materialForm.name.trim()) {
      setFormError("Give the material a name.");
      return;
    }
    if (!materialForm.unit.trim()) {
      setFormError("A unit of measure is required.");
      return;
    }
    const payload = {
      name: materialForm.name.trim(),
      category: materialForm.category,
      unit: materialForm.unit.trim(),
      unitCost: Number(materialForm.unitCost) || 0,
      reorderLevel: Number(materialForm.reorderLevel) || 0,
      preferredVendor: materialForm.preferredVendor || null,
      description: materialForm.description,
      isActive: materialForm.isActive,
    };
    if (materialForm.sku.trim()) payload.sku = materialForm.sku.trim();
    try {
      if (editingMaterial) {
        await updateMaterial({ id: editingMaterial._id, ...payload }).unwrap();
      } else {
        await createMaterial(payload).unwrap();
      }
      setMaterialDialog(false);
    } catch (saveError) {
      setFormError(getErrorMessage(saveError, "The material could not be saved."));
    }
  };

  const onArchive = async () => {
    try {
      await archiveMaterial(confirm.target).unwrap();
      confirm.close();
    } catch (archiveError) {
      setError(getErrorMessage(archiveError));
      confirm.close();
    }
  };

  const openMovement = (material = null, type = "In") => {
    setMovementForm({
      ...emptyMovement(),
      site: siteId || "",
      type,
      material: material?._id || "",
      unitCost: material?.unitCost ?? 0,
    });
    setMovementError("");
    setMovementDialog(true);
  };

  const updateMovement = (field) => (event) =>
    setMovementForm((current) => ({
      ...current,
      [field]: event.target.value,
      ...(field === "material"
        ? {
            unitCost:
              catalogue.find((material) => material._id === event.target.value)?.unitCost ??
              current.unitCost,
          }
        : {}),
    }));

  const onSaveMovement = async (event) => {
    event.preventDefault();
    setMovementError("");
    if (!movementForm.material) {
      setMovementError("Choose the material being moved.");
      return;
    }
    if (movementForm.type !== "Adjustment" && Number(movementForm.quantity) <= 0) {
      setMovementError("Quantity must be greater than zero.");
      return;
    }
    if (movementForm.type === "Adjustment" && !Number(movementForm.quantity)) {
      setMovementError("Enter a signed quantity for the correction.");
      return;
    }
    if (movementForm.type === "Adjustment" && !movementForm.note.trim()) {
      setMovementError("An adjustment needs a reason in the note.");
      return;
    }
    try {
      await createMovement({
        material: movementForm.material,
        ...(admin && movementForm.site ? { site: movementForm.site } : {}),
        type: movementForm.type,
        quantity: Number(movementForm.quantity),
        unitCost: Number(movementForm.unitCost) || 0,
        reference: movementForm.reference,
        note: movementForm.note,
        date: movementForm.date,
      }).unwrap();
      setMovementDialog(false);
    } catch (saveError) {
      setMovementError(getErrorMessage(saveError, "The movement could not be recorded."));
    }
  };

  const detail = detailQuery.data;

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Stock is derived from an append-only movement ledger. Every receipt, issue and correction is traceable."
        actions={
          <>
            {admin && (
              <Button variant="outline" onClick={openCreateMaterial}>
                <LuPackagePlus className="h-4 w-4" aria-hidden="true" /> New Material
              </Button>
            )}
            <Button variant="accent" onClick={() => openMovement()} disabled={admin && !siteId}>
              <LuPlus className="h-4 w-4" aria-hidden="true" /> Record Movement
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 sm:mb-5">
        <StatCard icon={LuBoxes} label="Materials" value={metrics.materials} tone="navy" />
        <StatCard icon={LuAlertTriangle} label="At reorder level" value={metrics.low} tone={metrics.low ? "warning" : "success"} />
        <StatCard icon={LuPackage} label="Out of stock" value={metrics.out} tone={metrics.out ? "danger" : "success"} />
        {admin && <StatCard icon={LuWarehouse} label="Stock value" value={formatINRCompact(metrics.value)} tone="accent" />}
      </div>

      {error && <div className="mb-4"><Alert variant="error" onDismiss={() => setError("")}>{error}</Alert></div>}

      <Card>
        <div className="flex flex-col gap-3 border-b border-concrete-200 px-4 py-3.5 sm:px-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-concrete-100 p-1">
            {TABS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  aria-pressed={tab === item.key}
                  className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-wide transition-colors ${
                    tab === item.key
                      ? "bg-navy-900 text-white shadow-card"
                      : "text-concrete-600 hover:bg-white hover:text-navy-800"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {admin && (
              <Select value={siteId} onChange={(event) => setSiteId(event.target.value)} aria-label="Select site" className="sm:!w-56">
                {reference.sites.length === 0 && <option value="">No sites available</option>}
                {reference.sites.map((item) => (
                  <option key={item._id} value={item._id}>{item.dep_name}</option>
                ))}
              </Select>
            )}
            <div className="relative w-full sm:w-64">
              <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-concrete-400" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search materials"
                aria-label="Search inventory"
                className="w-full rounded-md border border-concrete-300 bg-white py-2 pl-9 pr-3 text-sm text-navy-900 placeholder:text-concrete-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-400"
              />
            </div>
          </div>
        </div>

        {admin && !siteId ? (
          <EmptyState title="Choose a site" description="Stock is tracked per construction site." />
        ) : tab === "stock" ? (
          stockQuery.isLoading ? (
            <CardBody><p className="py-8 text-center text-sm text-concrete-500">Loading stock…</p></CardBody>
          ) : stockQuery.error ? (
            <EmptyState title="Could not load stock" description={getErrorMessage(stockQuery.error)} action={<Button variant="outline" onClick={stockQuery.refetch}>Try again</Button>} />
          ) : filteredStock.length === 0 ? (
            <EmptyState icon={LuWarehouse} title={term ? "No matching materials" : "No stock at this site"} description="Record a goods receipt to start the ledger." action={<Button variant="accent" onClick={() => openMovement()}>Record movement</Button>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-concrete-200 text-sm">
                <thead className="bg-concrete-50 text-left">
                  <tr>
                    {["Material", "Category", "On hand", "Reorder at", ...(admin ? ["Stock value"] : []), ""].map((heading) => (
                      <th key={heading} scope="col" className="whitespace-nowrap px-4 py-2.5 font-display text-2xs font-semibold uppercase tracking-wider text-concrete-500">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-concrete-100">
                  {filteredStock.map((row) => (
                    <tr key={row._id} className="hover:bg-concrete-50/70">
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => setDetailId(row._id)} className="text-left">
                          <p className="font-display font-semibold text-navy-900">{row.name}</p>
                          <p className="text-xs text-concrete-500">{row.sku}</p>
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-concrete-600">{row.category}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`font-display font-semibold tabular-nums ${row.onHand <= 0 ? "text-danger-600" : row.low ? "text-warning-700" : "text-navy-900"}`}>
                          {row.onHand} {row.unit}
                        </span>
                        {row.low && <Badge tone={row.onHand <= 0 ? "danger" : "warning"} className="ml-2">{row.onHand <= 0 ? "Out" : "Low"}</Badge>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-concrete-600">{row.reorderLevel} {row.unit}</td>
                      {admin && <td className="whitespace-nowrap px-4 py-3 tabular-nums text-concrete-600">{formatINR(row.stockValue)}</td>}
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <Button variant="outline" size="sm" onClick={() => openMovement(row, "In")}>Receive</Button>
                          <Button variant="outline" size="sm" onClick={() => openMovement(row, "Out")}>Issue</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : tab === "catalogue" ? (
          catalogueQuery.isLoading ? (
            <CardBody><p className="py-8 text-center text-sm text-concrete-500">Loading catalogue…</p></CardBody>
          ) : catalogueQuery.error ? (
            <EmptyState title="Could not load the catalogue" description={getErrorMessage(catalogueQuery.error)} action={<Button variant="outline" onClick={catalogueQuery.refetch}>Try again</Button>} />
          ) : filteredCatalogue.length === 0 ? (
            <EmptyState icon={LuPackage} title={term ? "No matching materials" : "No materials yet"} description={admin ? "Add the materials your sites use." : "The catalogue is maintained by an administrator."} action={admin ? <Button variant="accent" onClick={openCreateMaterial}>Add material</Button> : null} />
          ) : (
            <ul className="divide-y divide-concrete-100">
              {filteredCatalogue.map((row) => (
                <li key={row._id} className="flex flex-wrap items-start gap-3 px-4 py-3.5 sm:px-5">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setDetailId(row._id)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-sm font-semibold text-navy-900">{row.name}</p>
                      <Badge tone="neutral">{row.category}</Badge>
                      {row.isActive === false && <Badge tone="danger">Inactive</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-concrete-500">
                      {row.sku}{admin ? ` · ${formatINR(row.unitCost)}` : ""} / {row.unit}
                      {row.preferredVendor?.name ? ` · ${row.preferredVendor.name}` : ""}
                    </p>
                    {row.description && <p className="mt-1 line-clamp-1 text-sm text-concrete-600">{row.description}</p>}
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    {admin && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => openEditMaterial(row)}>Edit</Button>
                        {row.isActive !== false && (
                          <Button variant="ghost" size="sm" onClick={() => confirm.open(row._id)}>Deactivate</Button>
                        )}
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-concrete-200 px-4 py-2.5 sm:px-5">
              <div className="flex flex-wrap gap-1.5">
                {MOVEMENT_FILTERS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setMovementTypeFilter(item.value)}
                    aria-pressed={movementTypeFilter === item.value}
                    className={`rounded px-2.5 py-1 font-display text-2xs font-semibold uppercase tracking-wide transition-colors ${
                      movementTypeFilter === item.value
                        ? "bg-navy-900 text-white"
                        : "bg-concrete-100 text-concrete-600 hover:text-navy-800"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => openMovement()}>New movement</Button>
            </div>
            {movementsQuery.isLoading ? (
              <CardBody><p className="py-8 text-center text-sm text-concrete-500">Loading movements…</p></CardBody>
            ) : movements.length === 0 ? (
              <EmptyState icon={LuHistory} title="No movements recorded" description="Goods receipts, site issues and corrections will be listed here." />
            ) : (
              <ul className="divide-y divide-concrete-100">
                {movements.map((movement) => (
                  <li key={movement._id} className="flex flex-wrap items-start gap-3 px-4 py-3 sm:px-5">
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                      movement.type === "In" ? "bg-success-50 text-success-700" : movement.type === "Out" ? "bg-warning-50 text-warning-700" : "bg-info-50 text-info-700"
                    }`}>
                      {movement.type === "In" ? <LuArrowDownToLine className="h-4 w-4" /> : movement.type === "Out" ? <LuArrowUpFromLine className="h-4 w-4" /> : <LuHistory className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-sm font-semibold text-navy-900">
                          {movement.material?.name || "Material"}
                        </p>
                        <Badge tone={movementTone(movement.type)}>{movement.type}</Badge>
                        <span className={`text-sm font-semibold tabular-nums ${movement.type === "Out" ? "text-warning-700" : movement.type === "In" ? "text-success-700" : "text-info-700"}`}>
                          {movement.type === "Adjustment" && Number(movement.quantity) > 0 ? "+" : ""}
                          {movement.quantity} {movement.material?.unit}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-concrete-500">
                        {formatDate(movement.date)} · {movement.site?.dep_name || site?.dep_name || "Site"}
                        {movement.reference ? ` · ${movement.reference}` : ""}
                        {movement.createdBy?.name ? ` · ${movement.createdBy.name}` : ""}
                      </p>
                      {movement.note && <p className="mt-1 text-xs text-concrete-600">{movement.note}</p>}
                    </div>
                    <span className="shrink-0 text-2xs uppercase tracking-wide text-concrete-400">{movement.source}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Card>

      {lowStock.length > 0 && tab === "stock" && (
        <Card className="mt-4 border-warning-500/30">
          <CardBody>
            <div className="flex items-start gap-3">
              <LuAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-600" aria-hidden="true" />
              <div>
                <p className="font-display text-sm font-semibold uppercase tracking-wide text-warning-700">
                  {lowStock.length} material line(s) need replenishment
                </p>
                <p className="mt-1 text-xs text-concrete-600">
                  {lowStock.slice(0, 5).map((row) => `${row.name} (${row.balance} ${row.unit})`).join(" · ")}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Material create / edit */}
      <Modal
        open={materialDialog}
        onClose={() => setMaterialDialog(false)}
        title={editingMaterial ? "Edit material" : "New material"}
        description="The material code is generated automatically unless you supply one."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setMaterialDialog(false)}>Cancel</Button>
            <Button variant="accent" form="material-form" type="submit" loading={materialSaving}>
              {editingMaterial ? "Save changes" : "Add material"}
            </Button>
          </>
        }
      >
        <form id="material-form" onSubmit={onSaveMaterial} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {formError && <div className="sm:col-span-2"><Alert variant="error">{formError}</Alert></div>}
          <Input label="Name" value={materialForm.name} onChange={updateMaterialField("name")} required />
          <Input label="Material code" value={materialForm.sku} onChange={updateMaterialField("sku")} hint="Leave blank to auto-generate" disabled={Boolean(editingMaterial)} />
          <Select label="Category" value={materialForm.category} onChange={updateMaterialField("category")}>
            {MATERIAL_CATEGORIES.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
          <Input label="Unit of measure" value={materialForm.unit} onChange={updateMaterialField("unit")} required placeholder="Bag, Tonne, Metre, Piece…" />
          <Input label="Unit cost (₹)" type="number" min="0" step="0.01" value={materialForm.unitCost} onChange={updateMaterialField("unitCost")} />
          <Input label="Reorder level" type="number" min="0" value={materialForm.reorderLevel} onChange={updateMaterialField("reorderLevel")} />
          <Select label="Preferred vendor" value={materialForm.preferredVendor} onChange={updateMaterialField("preferredVendor")}>
            <option value="">No preference</option>
            {reference.vendors.map((vendor) => <option key={vendor._id} value={vendor._id}>{vendor.name}</option>)}
          </Select>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-navy-800">
              <input type="checkbox" checked={materialForm.isActive} onChange={updateMaterialField("isActive")} className="h-4 w-4 rounded border-concrete-300 accent-navy-900" />
              Active in the catalogue
            </label>
          </div>
          <div className="sm:col-span-2">
            <Textarea label="Description" rows={2} value={materialForm.description} onChange={updateMaterialField("description")} />
          </div>
        </form>
      </Modal>

      {/* Movement */}
      <Modal
        open={movementDialog}
        onClose={() => setMovementDialog(false)}
        title="Record stock movement"
        description="Receipts add stock, issues deduct it, and an adjustment corrects the counted balance with a reason."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setMovementDialog(false)}>Cancel</Button>
            <Button variant="accent" form="movement-form" type="submit" loading={movementState.isLoading}>
              Record movement
            </Button>
          </>
        }
      >
        <form id="movement-form" onSubmit={onSaveMovement} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {movementError && <div className="sm:col-span-2"><Alert variant="error">{movementError}</Alert></div>}
          <div className="sm:col-span-2">
            <Select label="Material" value={movementForm.material} onChange={updateMovement("material")} required>
              <option value="">Select material</option>
              {catalogue.map((material) => (
                <option key={material._id} value={material._id}>{material.sku} · {material.name}</option>
              ))}
            </Select>
          </div>
          {admin && (
            <Select label="Site" value={movementForm.site} onChange={updateMovement("site")} required>
              <option value="">Select site</option>
              {reference.sites.map((item) => <option key={item._id} value={item._id}>{item.dep_name}</option>)}
            </Select>
          )}
          <Select label="Movement type" value={movementForm.type} onChange={updateMovement("type")}>
            {MOVEMENT_TYPES.filter((type) => admin || type !== "Adjustment").map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </Select>
          <Input
            label={movementForm.type === "Adjustment" ? "Signed quantity" : "Quantity"}
            type="number"
            step="0.01"
            value={movementForm.quantity}
            onChange={updateMovement("quantity")}
            hint={movementForm.type === "Adjustment" ? "Use a negative value to reduce the counted stock." : undefined}
            required
          />
          {admin && (
            <Input label="Unit cost (₹)" type="number" min="0" step="0.01" value={movementForm.unitCost} onChange={updateMovement("unitCost")} />
          )}
          <Input label="Date" type="date" value={movementForm.date} onChange={updateMovement("date")} max={dateInput(new Date())} />
          <Input label="Reference" value={movementForm.reference} onChange={updateMovement("reference")} placeholder="GRN, challan or issue slip" />
          <div className="sm:col-span-2">
            <Textarea
              label={movementForm.type === "Adjustment" ? "Reason (required)" : "Note"}
              rows={2}
              value={movementForm.note}
              onChange={updateMovement("note")}
              required={movementForm.type === "Adjustment"}
            />
          </div>
        </form>
      </Modal>

      {/* Material detail */}
      <Modal
        open={Boolean(detailId)}
        onClose={() => setDetailId(null)}
        title={detail?.material?.name || "Material"}
        description={detail?.material ? `${detail.material.sku} · ${detail.material.category}` : "Loading material…"}
        size="lg"
        footer={<Button variant="outline" onClick={() => setDetailId(null)}>Close</Button>}
      >
        {detailQuery.isLoading ? (
          <p className="py-6 text-center text-sm text-concrete-500">Loading material…</p>
        ) : detailQuery.error ? (
          <Alert variant="error">{getErrorMessage(detailQuery.error)}</Alert>
        ) : detail ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 rounded-md bg-concrete-50 p-3 text-sm sm:grid-cols-4">
              <div><dt className="text-xs text-concrete-500">On hand</dt><dd className="mt-1 font-display font-semibold text-navy-900">{detail.stock?.onHand ?? 0} {detail.material.unit}</dd></div>
              {admin && (
                <div><dt className="text-xs text-concrete-500">Unit cost</dt><dd className="mt-1 text-navy-900">{formatINR(detail.material.unitCost)}</dd></div>
              )}
              <div><dt className="text-xs text-concrete-500">Reorder at</dt><dd className="mt-1 text-navy-900">{detail.material.reorderLevel} {detail.material.unit}</dd></div>
              <div><dt className="text-xs text-concrete-500">Movements</dt><dd className="mt-1 text-navy-900">{detail.stock?.movements ?? 0}</dd></div>
            </dl>
            {detail.material.description && <p className="text-sm text-concrete-600">{detail.material.description}</p>}
            <div>
              <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-concrete-500">Recent movements</h3>
              {detail.recent?.length ? (
                <ul className="mt-1 divide-y divide-concrete-100 rounded-md border border-concrete-200">
                  {detail.recent.map((movement) => (
                    <li key={movement._id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0">
                        <Badge tone={movementTone(movement.type)}>{movement.type}</Badge>
                        <span className="ml-2 text-concrete-600">{movement.reference || movement.note || "—"}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-semibold tabular-nums text-navy-900">{movement.quantity} {detail.material.unit}</span>
                        <span className="block text-xs text-concrete-500">{formatDateTime(movement.date)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-concrete-500">No movements at this site yet.</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setDetailId(null); openMovement(detail.material, "In"); }}>Receive stock</Button>
              <Button variant="outline" onClick={() => { setDetailId(null); openMovement(detail.material, "Out"); }}>Issue stock</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={confirm.confirmOpen}
        onCancel={confirm.close}
        onConfirm={onArchive}
        title="Deactivate this material?"
        description="It disappears from the active catalogue but its full movement history is preserved. Stock on hand must be zero first."
        confirmLabel="Deactivate"
        variant="warning"
        loading={archiveState.isLoading}
      />
    </>
  );
};

export default Inventory;

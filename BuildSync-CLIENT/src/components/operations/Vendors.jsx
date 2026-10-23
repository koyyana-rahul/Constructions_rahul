import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  LuBuilding2,
  LuMail,
  LuMapPin,
  LuPhone,
  LuPlus,
  LuSearch,
  LuStar,
  LuTruck,
} from "react-icons/lu";
import PageHeader from "../../components/ui/PageHeader";
import { Card, CardBody } from "../../components/ui/Card";
import StatCard from "../../components/ui/StatCard";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { Alert, EmptyState } from "../../components/ui/Feedback";
import { FilterChips } from "../../components/ui/Toolbar";
import { Input, Select, Textarea } from "../../components/ui/Form";
import Modal from "../../components/ui/Modal";
import ConfirmDialog, { useConfirm } from "../../components/ui/ConfirmDialog";
import { getErrorMessage } from "../../lib/api";
import { formatINR, formatINRCompact } from "../../utils/format";
import {
  useArchiveVendorMutation,
  useCreateVendorMutation,
  useGetVendorsQuery,
  useUpdateVendorMutation,
} from "../../services/api/endpoints/commercialApi";

const VENDOR_CATEGORIES = ["Materials", "Equipment", "Subcontractor", "Transport", "Consultant", "Other"];

const CATEGORY_FILTERS = [
  { value: "", label: "All" },
  ...VENDOR_CATEGORIES.map((category) => ({ value: category, label: category })),
];

const EMPTY_VENDOR = {
  name: "",
  category: "Materials",
  contactName: "",
  email: "",
  phone: "",
  gstin: "",
  address: "",
  rating: "",
  notes: "",
};

const Vendors = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_VENDOR);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const confirm = useConfirm();

  const { data, isLoading, error: loadError, refetch } = useGetVendorsQuery({
    limit: 200,
    category: category || undefined,
    includeInactive: true,
  });
  const [createVendor, createState] = useCreateVendorMutation();
  const [updateVendor, updateState] = useUpdateVendorMutation();
  const [archiveVendor, archiveState] = useArchiveVendorMutation();

  const saving = createState.isLoading || updateState.isLoading;

  const vendors = useMemo(() => {
    const list = data?.vendors ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter((vendor) =>
      [vendor.name, vendor.contactName, vendor.email, vendor.phone, vendor.gstin, vendor.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [data, search]);

  const metrics = useMemo(() => {
    const list = data?.vendors ?? [];
    const rated = list.filter((vendor) => vendor.rating);
    return {
      total: list.length,
      active: list.filter((vendor) => vendor.isActive !== false).length,
      spend: list.reduce((sum, vendor) => sum + (vendor.spend || 0), 0),
      rating: rated.length
        ? (rated.reduce((sum, vendor) => sum + vendor.rating, 0) / rated.length).toFixed(1)
        : "—",
    };
  }, [data]);

  useEffect(() => {
    if (!id) return;
    const match = (data?.vendors ?? []).find((vendor) => vendor._id === id);
    if (match) openEdit(match);
  }, [id, data]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_VENDOR);
    setFormError("");
    setDialogOpen(true);
  };

  const openEdit = (vendor) => {
    setEditing(vendor);
    setForm({
      name: vendor.name || "",
      category: vendor.category || "Materials",
      contactName: vendor.contactName || "",
      email: vendor.email || "",
      phone: vendor.phone || "",
      gstin: vendor.gstin || "",
      address: vendor.address || "",
      rating: vendor.rating || "",
      notes: vendor.notes || "",
    });
    setFormError("");
    setDialogOpen(true);
  };

  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    if (!form.name.trim()) {
      setFormError("Enter the vendor's name.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      category: form.category,
      contactName: form.contactName,
      email: form.email,
      phone: form.phone,
      gstin: form.gstin,
      address: form.address,
      notes: form.notes,
      rating: form.rating === "" ? null : Number(form.rating),
    };
    try {
      if (editing) {
        await updateVendor({ id: editing._id, ...payload, rating: form.rating === "" ? 0 : Number(form.rating) }).unwrap();
      } else {
        await createVendor(payload).unwrap();
      }
      setDialogOpen(false);
      if (id) navigate(-1);
    } catch (submitError) {
      setFormError(getErrorMessage(submitError, "The vendor could not be saved."));
    }
  };

  const onArchive = async () => {
    try {
      await archiveVendor(confirm.target).unwrap();
      confirm.close();
    } catch (archiveError) {
      setError(getErrorMessage(archiveError));
      confirm.close();
    }
  };

  const onReactivate = async (vendor) => {
    setError("");
    try {
      await updateVendor({ id: vendor._id, isActive: true }).unwrap();
    } catch (reactivateError) {
      setError(getErrorMessage(reactivateError, "The vendor could not be reactivated."));
    }
  };

  return (
    <>
      <PageHeader
        title="Vendors"
        description="Suppliers, subcontractors and service partners, with spend traced back to approved costs."
        actions={
          <Button variant="accent" onClick={openCreate}>
            <LuPlus className="h-4 w-4" aria-hidden="true" /> New Vendor
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 sm:mb-5">
        <StatCard icon={LuTruck} label="Vendors" value={metrics.total} tone="navy" />
        <StatCard icon={LuBuilding2} label="Active" value={metrics.active} tone="success" />
        <StatCard icon={LuStar} label="Average rating" value={metrics.rating} tone="accent" hint="Out of 5" />
        <StatCard icon={LuTruck} label="Approved spend" value={formatINRCompact(metrics.spend)} tone="navy" />
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
              placeholder="Search vendors"
              aria-label="Search vendors"
              className="w-full rounded-md border border-concrete-300 bg-white py-2 pl-9 pr-3 text-sm text-navy-900 placeholder:text-concrete-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-400"
            />
          </div>
          <FilterChips options={CATEGORY_FILTERS} value={category} onChange={setCategory} ariaLabel="Filter vendors by category" />
        </div>

        {isLoading ? (
          <CardBody><p className="py-8 text-center text-sm text-concrete-500">Loading vendors…</p></CardBody>
        ) : loadError ? (
          <EmptyState title="Could not load vendors" description={getErrorMessage(loadError)} action={<Button variant="outline" onClick={refetch}>Try again</Button>} />
        ) : vendors.length === 0 ? (
          <EmptyState icon={LuTruck} title={search || category ? "No matching vendors" : "No vendors yet"} description="Add the suppliers and subcontractors you buy from." action={<Button variant="accent" onClick={openCreate}>Add vendor</Button>} />
        ) : (
          <ul className="divide-y divide-concrete-100">
            {vendors.map((vendor) => (
              <li key={vendor._id} className="flex flex-wrap items-start gap-3 px-4 py-3.5 sm:px-5">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-navy-50 text-navy-700">
                  <LuBuilding2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openEdit(vendor)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-sm font-semibold text-navy-900">{vendor.name}</p>
                    <Badge tone="neutral">{vendor.category}</Badge>
                    {vendor.isActive === false && <Badge tone="danger">Inactive</Badge>}
                    {vendor.rating ? (
                      <span className="inline-flex items-center gap-1 text-xs text-warning-700">
                        <LuStar className="h-3.5 w-3.5 fill-current" aria-hidden="true" /> {vendor.rating}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-concrete-500">
                    {vendor.contactName && <span>{vendor.contactName}</span>}
                    {vendor.phone && <span className="inline-flex items-center gap-1"><LuPhone className="h-3 w-3" />{vendor.phone}</span>}
                    {vendor.email && <span className="inline-flex items-center gap-1"><LuMail className="h-3 w-3" />{vendor.email}</span>}
                    {vendor.address && <span className="inline-flex items-center gap-1"><LuMapPin className="h-3 w-3" />{vendor.address}</span>}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-concrete-500">
                    <span>Spend {formatINR(vendor.spend || 0)}</span>
                    <span>{vendor.expenseCount || 0} expense(s)</span>
                    {vendor.materialCount > 0 && <span>{vendor.materialCount} preferred material(s)</span>}
                    {vendor.gstin && <span>GSTIN {vendor.gstin}</span>}
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => openEdit(vendor)}>Edit</Button>
                  {vendor.isActive === false ? (
                    <Button variant="ghost" size="sm" loading={updateState.isLoading} onClick={() => onReactivate(vendor)}>
                      Reactivate
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => confirm.open(vendor._id)}>Deactivate</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? "Edit vendor" : "New vendor"}
        description="Commercial terms and contact details for a supplier or subcontractor."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="accent" form="vendor-form" type="submit" loading={saving}>
              {editing ? "Save changes" : "Add vendor"}
            </Button>
          </>
        }
      >
        <form id="vendor-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {formError && <div className="sm:col-span-2"><Alert variant="error">{formError}</Alert></div>}
          <Input label="Vendor name" value={form.name} onChange={update("name")} required />
          <Select label="Category" value={form.category} onChange={update("category")}>
            {VENDOR_CATEGORIES.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
          <Input label="Contact person" value={form.contactName} onChange={update("contactName")} />
          <Input label="Phone" value={form.phone} onChange={update("phone")} />
          <Input label="Email" type="email" value={form.email} onChange={update("email")} />
          <Input label="GSTIN" value={form.gstin} onChange={update("gstin")} />
          <Select label="Rating" value={form.rating} onChange={update("rating")}>
            <option value="">Not rated</option>
            {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}
          </Select>
          <Input label="Address" value={form.address} onChange={update("address")} />
          <div className="sm:col-span-2">
            <Textarea label="Notes" rows={2} value={form.notes} onChange={update("notes")} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirm.confirmOpen}
        onCancel={confirm.close}
        onConfirm={onArchive}
        title="Deactivate this vendor?"
        description="They disappear from active lists, but their expense and material history stays intact. You can reactivate them at any time."
        confirmLabel="Deactivate"
        variant="warning"
        loading={archiveState.isLoading}
      />
    </>
  );
};

export default Vendors;

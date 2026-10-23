import { useMemo, useState } from "react";
import {
  LuIndianRupee,
  LuDownload,
  LuFileText,
  LuPlus,
  LuReceipt,
  LuSearch,
  LuTrash2,
  LuWallet,
  LuXCircle,
} from "react-icons/lu";
import PageHeader from "../../components/ui/PageHeader";
import { Card, CardBody } from "../../components/ui/Card";
import StatCard from "../../components/ui/StatCard";
import Button from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/Badge";
import { Alert, EmptyState } from "../../components/ui/Feedback";
import { FilterChips } from "../../components/ui/Toolbar";
import { Input, Select, Textarea } from "../../components/ui/Form";
import Modal from "../../components/ui/Modal";
import ConfirmDialog, { useConfirm } from "../../components/ui/ConfirmDialog";
import { downloadExport } from "../../lib/download";
import { getErrorMessage } from "../../lib/api";
import { formatINR, formatINRCompact } from "../../utils/format";
import {
  useApproveExpenseMutation,
  useCreateExpenseMutation,
  useDeleteExpenseMutation,
  useGetExpenseSummaryQuery,
  useGetExpensesQuery,
  useMarkExpensePaidMutation,
  useRejectExpenseMutation,
  useUpdateExpenseMutation,
} from "../../services/api/endpoints/commercialApi";
import {
  dateInput,
  formatDate,
  projectName,
  useOperationReference,
} from "../../components/operations/shared";

const CATEGORIES = [
  "Labour",
  "Materials",
  "Equipment",
  "Subcontractor",
  "Transport",
  "Utilities",
  "Permits",
  "Professional Fees",
  "Other",
];

const PAYMENT_METHODS = ["Cash", "Bank Transfer", "UPI", "Cheque", "Card", "Other"];

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Paid", label: "Paid" },
  { value: "Rejected", label: "Rejected" },
];

const emptyForm = () => ({
  project: "",
  site: "",
  vendor: "",
  category: "Materials",
  description: "",
  amount: "",
  taxAmount: 0,
  date: dateInput(new Date()),
  paymentMethod: "Bank Transfer",
  reference: "",
  notes: "",
});

const Expenses = () => {
  const [projectFilter, setProjectFilter] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const confirm = useConfirm();

  const reference = useOperationReference({ projects: true, sites: true, vendors: true });

  const { data, isLoading, error: loadError, refetch } = useGetExpensesQuery({
    limit: 200,
    project: projectFilter || undefined,
    status: status || undefined,
  });
  const { data: summary } = useGetExpenseSummaryQuery({ project: projectFilter || undefined });

  const [createExpense, createState] = useCreateExpenseMutation();
  const [updateExpense, updateState] = useUpdateExpenseMutation();
  const [approveExpense, approveState] = useApproveExpenseMutation();
  const [rejectExpense, rejectState] = useRejectExpenseMutation();
  const [markPaid, paidState] = useMarkExpensePaidMutation();
  const [deleteExpense, deleteState] = useDeleteExpenseMutation();

  const saving = createState.isLoading || updateState.isLoading;

  const expenses = useMemo(() => {
    const list = data?.expenses ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter((expense) =>
      [expense.description, expense.reference, expense.vendor?.name, expense.project?.name, expense.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [data, search]);

  const metrics = useMemo(
    () => ({
      pending: summary?.pending?.total ?? 0,
      pendingCount: summary?.pending?.count ?? 0,
      cost: summary?.costToDate ?? 0,
      paid: summary?.paid?.total ?? 0,
      rejected: summary?.rejected?.count ?? 0,
    }),
    [summary]
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm(), project: projectFilter || "" });
    setReceipt(null);
    setFormError("");
    setDialogOpen(true);
  };

  const openEdit = (expense) => {
    setEditing(expense);
    setForm({
      project: expense.project?._id || expense.project || "",
      site: expense.site?._id || expense.site || "",
      vendor: expense.vendor?._id || expense.vendor || "",
      category: expense.category || "Materials",
      description: expense.description || "",
      amount: expense.amount ?? "",
      taxAmount: expense.taxAmount ?? 0,
      date: dateInput(expense.date),
      paymentMethod: expense.paymentMethod || "Bank Transfer",
      reference: expense.reference || "",
      notes: expense.notes || "",
    });
    setReceipt(null);
    setFormError("");
    setDialogOpen(true);
  };

  const update = (field) => (event) =>
    setForm((current) => ({
      ...current,
      [field]: event.target.value,
      ...(field === "project"
        ? {
            site:
              reference.projects.find((project) => project._id === event.target.value)?.site?._id ||
              current.site,
          }
        : {}),
    }));

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    if (!form.description.trim()) {
      setFormError("Describe what this expense was for.");
      return;
    }
    if (!(Number(form.amount) > 0)) {
      setFormError("Enter an amount greater than zero.");
      return;
    }
    const payload = new FormData();
    payload.append("project", form.project);
    payload.append("site", form.site);
    payload.append("vendor", form.vendor);
    payload.append("category", form.category);
    payload.append("description", form.description.trim());
    payload.append("amount", String(Number(form.amount)));
    payload.append("taxAmount", String(Number(form.taxAmount) || 0));
    payload.append("date", form.date);
    payload.append("paymentMethod", form.paymentMethod);
    payload.append("reference", form.reference || "");
    payload.append("notes", form.notes || "");
    if (receipt) payload.append("receipt", receipt);

    try {
      if (editing) {
        await updateExpense({ id: editing._id, formData: payload }).unwrap();
      } else {
        await createExpense(payload).unwrap();
      }
      setDialogOpen(false);
    } catch (submitError) {
      setFormError(getErrorMessage(submitError, "The expense could not be saved."));
    }
  };

  const runAction = async (action, expense) => {
    setError("");
    try {
      await action(expense._id).unwrap();
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    }
  };

  const onReject = async () => {
    if (!rejectReason.trim()) return;
    try {
      await rejectExpense({ id: rejecting._id, reason: rejectReason.trim() }).unwrap();
      setRejecting(null);
      setRejectReason("");
    } catch (rejectError) {
      setError(getErrorMessage(rejectError));
      setRejecting(null);
    }
  };

  const onDelete = async () => {
    try {
      await deleteExpense(confirm.target).unwrap();
      confirm.close();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
      confirm.close();
    }
  };

  const onExport = async () => {
    setError("");
    try {
      await downloadExport("/expense/export", "expenses.csv");
    } catch (exportError) {
      setError(getErrorMessage(exportError, "The export could not be downloaded."));
    }
  };

  const onDownloadReceipt = async (expense) => {
    setError("");
    try {
      await downloadExport(`/expense/${expense._id}/receipt`, `receipt-${expense._id}.pdf`);
    } catch (downloadError) {
      setError(getErrorMessage(downloadError, "The receipt could not be downloaded."));
    }
  };

  const editable = (expense) => !["Approved", "Paid"].includes(expense.status);

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Project cost, overheads and vendor bills. Only approved and paid entries count towards cost to date."
        actions={
          <>
            <Button variant="outline" onClick={onExport}>
              <LuDownload className="h-4 w-4" aria-hidden="true" /> Export CSV
            </Button>
            <Button variant="accent" onClick={openCreate}>
              <LuPlus className="h-4 w-4" aria-hidden="true" /> Record Expense
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 sm:mb-5">
        <StatCard icon={LuFileText} label="Pending approval" value={formatINRCompact(metrics.pending)} hint={`${metrics.pendingCount} expense(s)`} tone={metrics.pendingCount ? "warning" : "success"} />
        <StatCard icon={LuIndianRupee} label="Cost to date" value={formatINRCompact(metrics.cost)} hint="Approved + paid" tone="navy" />
        <StatCard icon={LuWallet} label="Paid" value={formatINRCompact(metrics.paid)} tone="success" />
        <StatCard icon={LuXCircle} label="Rejected" value={metrics.rejected} tone="neutral" />
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
                placeholder="Search expenses"
                aria-label="Search expenses"
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
          <FilterChips options={STATUS_FILTERS} value={status} onChange={setStatus} ariaLabel="Filter expenses by status" />
        </div>

        {isLoading ? (
          <CardBody><p className="py-8 text-center text-sm text-concrete-500">Loading expenses…</p></CardBody>
        ) : loadError ? (
          <EmptyState title="Could not load expenses" description={getErrorMessage(loadError)} action={<Button variant="outline" onClick={refetch}>Try again</Button>} />
        ) : expenses.length === 0 ? (
          <EmptyState icon={LuReceipt} title={search || status ? "No matching expenses" : "No expenses recorded"} description="Record project spend to track cost against budget." action={<Button variant="accent" onClick={openCreate}>Record an expense</Button>} />
        ) : (
          <ul className="divide-y divide-concrete-100">
            {expenses.map((expense) => (
              <li key={expense._id} className="px-4 py-3.5 sm:px-5">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <button type="button" className="block w-full text-left" onClick={() => editable(expense) && openEdit(expense)}>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-sm font-semibold text-navy-900">{expense.description}</p>
                        <StatusBadge status={expense.status} />
                        <span className="text-2xs uppercase tracking-wide text-concrete-500">{expense.category}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-concrete-500">
                        <span>{formatDate(expense.date)}</span>
                        {expense.project ? <span>{expense.project.code} · {projectName(expense.project)}</span> : <span>General overhead</span>}
                        {expense.site?.dep_name && <span>{expense.site.dep_name}</span>}
                        {expense.vendor?.name && <span>{expense.vendor.name}</span>}
                        {expense.reference && <span>Ref {expense.reference}</span>}
                      </div>
                      {expense.rejectionReason && <p className="mt-1 text-xs text-danger-600">Rejected: {expense.rejectionReason}</p>}
                    </button>
                    {expense.receipt && (
                      <button
                        type="button"
                        onClick={() => onDownloadReceipt(expense)}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-accent-700 hover:text-accent-800"
                      >
                        <LuReceipt className="h-3.5 w-3.5" /> Receipt
                      </button>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-display text-base font-semibold tabular-nums text-navy-900">{formatINR(expense.totalAmount)}</p>
                    <p className="text-2xs uppercase tracking-wide text-concrete-500">
                      {expense.taxAmount ? `incl. ${formatINR(expense.taxAmount)} tax` : expense.paymentMethod}
                    </p>
                  </div>
                  <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-1 sm:w-auto">
                    {expense.status === "Pending" && (
                      <>
                        <Button variant="primary" size="sm" loading={approveState.isLoading} onClick={() => runAction(approveExpense, expense)}>Approve</Button>
                        <Button variant="outline" size="sm" onClick={() => { setRejecting(expense); setRejectReason(""); }}>Reject</Button>
                        <Button variant="outline" size="sm" onClick={() => openEdit(expense)}>Edit</Button>
                      </>
                    )}
                    {expense.status === "Approved" && (
                      <>
                        <Button variant="accent" size="sm" loading={paidState.isLoading} onClick={() => runAction(markPaid, expense)}>Mark paid</Button>
                        <Button variant="outline" size="sm" onClick={() => { setRejecting(expense); setRejectReason(""); }}>Reject</Button>
                      </>
                    )}
                    {editable(expense) && (
                      <Button variant="ghost" size="icon" aria-label="Delete expense" onClick={() => confirm.open(expense._id)}>
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

      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? "Edit expense" : "Record expense"}
        description="Attach the bill or receipt. Receipts are stored privately and only administrators can open them."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="accent" form="expense-form" type="submit" loading={saving}>
              {editing ? "Save changes" : "Record expense"}
            </Button>
          </>
        }
      >
        <form id="expense-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {formError && <div className="sm:col-span-2"><Alert variant="error">{formError}</Alert></div>}
          <div className="sm:col-span-2">
            <Input label="Description" value={form.description} onChange={update("description")} required placeholder="What was purchased?" />
          </div>
          <Select label="Category" value={form.category} onChange={update("category")} required>
            {CATEGORIES.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
          <Input label="Expense date" type="date" value={form.date} onChange={update("date")} max={dateInput(new Date())} required />
          <Select label="Project" value={form.project} onChange={update("project")}>
            <option value="">General overhead</option>
            {reference.projects.map((project) => (
              <option key={project._id} value={project._id}>{project.code} · {projectName(project)}</option>
            ))}
          </Select>
          <Select label="Site" value={form.site} onChange={update("site")}>
            <option value="">No site</option>
            {reference.sites.map((site) => <option key={site._id} value={site._id}>{site.dep_name}</option>)}
          </Select>
          <Select label="Vendor" value={form.vendor} onChange={update("vendor")}>
            <option value="">No vendor</option>
            {reference.vendors.map((vendor) => <option key={vendor._id} value={vendor._id}>{vendor.name}</option>)}
          </Select>
          <Input label="Reference / bill no." value={form.reference} onChange={update("reference")} />
          <Input label="Amount (₹)" type="number" min="0.01" step="0.01" value={form.amount} onChange={update("amount")} required />
          <Input label="Tax amount (₹)" type="number" min="0" step="0.01" value={form.taxAmount} onChange={update("taxAmount")} />
          <Select label="Payment method" value={form.paymentMethod} onChange={update("paymentMethod")}>
            {PAYMENT_METHODS.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
          <div className="sm:col-span-2">
            <label htmlFor="expense-receipt" className="mb-1.5 block font-display text-xs font-semibold uppercase tracking-wider text-navy-700">
              Bill / receipt
            </label>
            <input
              id="expense-receipt"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(event) => setReceipt(event.target.files?.[0] || null)}
              className="block w-full cursor-pointer rounded-md border border-concrete-300 bg-white px-3 py-2 text-sm text-navy-900 file:mr-3 file:rounded file:border-0 file:bg-concrete-100 file:px-3 file:py-1.5 file:font-display file:text-xs file:font-semibold file:uppercase file:tracking-wide file:text-navy-800"
            />
            {editing?.receipt && !receipt && <p className="mt-1 text-xs text-concrete-500">A receipt is attached. Upload a new file to replace it.</p>}
            {receipt && <p className="mt-1 text-xs text-concrete-500">{receipt.name} selected.</p>}
          </div>
          <div className="sm:col-span-2">
            <Textarea label="Notes" rows={2} value={form.notes} onChange={update("notes")} />
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title="Reject expense"
        description="The expense stays visible but is excluded from cost reporting."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="danger" onClick={onReject} loading={rejectState.isLoading} disabled={!rejectReason.trim()}>
              Reject expense
            </Button>
          </>
        }
      >
        <label htmlFor="expense-reject-reason" className="mb-1.5 block font-display text-xs font-semibold uppercase tracking-wider text-navy-700">
          Reason
        </label>
        <textarea
          id="expense-reject-reason"
          rows={3}
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
          className="block w-full rounded-md border border-concrete-300 px-3 py-2 text-sm text-navy-900 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-400"
          placeholder="Why is this expense not approved?"
        />
      </Modal>

      <ConfirmDialog
        open={confirm.confirmOpen}
        onCancel={confirm.close}
        onConfirm={onDelete}
        title="Delete this expense?"
        description="Its receipt file is also removed. Approved and paid expenses cannot be deleted."
        confirmLabel="Delete expense"
        loading={deleteState.isLoading}
      />
    </>
  );
};

export default Expenses;

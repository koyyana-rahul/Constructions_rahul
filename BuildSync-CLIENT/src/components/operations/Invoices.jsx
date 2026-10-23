import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  LuCheckCircle2,
  LuClock,
  LuDownload,
  LuFileText,
  LuPlus,
  LuPrinter,
  LuSearch,
  LuTrash2,
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
import { useCurrentUser } from "../../features/auth/useSession";
import {
  useCancelInvoiceMutation,
  useCreateInvoiceMutation,
  useDeleteInvoiceMutation,
  useGetInvoiceQuery,
  useGetInvoiceSummaryQuery,
  useGetInvoicesQuery,
  useRecordInvoicePaymentMutation,
  useSendInvoiceMutation,
  useUpdateInvoiceMutation,
} from "../../services/api/endpoints/commercialApi";
import { useGetOrganizationQuery } from "../../services/api/endpoints/platformApi";
import {
  clientName,
  dateInput,
  formatDate,
  formatDateTime,
  projectName,
  useOperationReference,
} from "../../components/operations/shared";

const PAYMENT_METHODS = ["Cash", "Bank Transfer", "UPI", "Cheque", "Card", "Other"];

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "Draft", label: "Draft" },
  { value: "Sent", label: "Sent" },
  { value: "Partially Paid", label: "Partial" },
  { value: "Paid", label: "Paid" },
  { value: "Overdue", label: "Overdue" },
  { value: "Cancelled", label: "Cancelled" },
];

const emptyLine = () => ({ description: "", quantity: 1, unit: "Item", rate: 0 });

const emptyForm = () => ({
  project: "",
  issueDate: dateInput(new Date()),
  dueDate: dateInput(new Date(Date.now() + 30 * 86400000)),
  discountAmount: 0,
  taxRate: 18,
  notes: "",
  terms: "",
  lineItems: [emptyLine()],
});

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const invoiceTotals = (form) => {
  const subtotal = form.lineItems.reduce(
    (sum, item) => sum + toNumber(item.quantity) * toNumber(item.rate),
    0
  );
  const taxable = Math.max(0, subtotal - toNumber(form.discountAmount));
  const tax = (taxable * toNumber(form.taxRate)) / 100;
  return { subtotal, tax, total: taxable + tax };
};

const Invoices = () => {
  const { id: routeId } = useParams();
  const user = useCurrentUser();
  const admin = user?.role === "admin";

  const [status, setStatus] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState(routeId || null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [paymentFor, setPaymentFor] = useState(null);
  const [payment, setPayment] = useState({ amount: "", date: dateInput(new Date()), method: "Bank Transfer", reference: "" });
  const [cancelling, setCancelling] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const confirm = useConfirm();

  const reference = useOperationReference({ projects: true });
  const { data: organization } = useGetOrganizationQuery();

  const { data, isLoading, error: loadError, refetch } = useGetInvoicesQuery({
    limit: 200,
    status: status || undefined,
    project: projectFilter || undefined,
  });
  const { data: summary } = useGetInvoiceSummaryQuery();
  const { data: detailData, isLoading: detailLoading, error: detailError } = useGetInvoiceQuery(detailId, { skip: !detailId });

  const [createInvoice, createState] = useCreateInvoiceMutation();
  const [updateInvoice, updateState] = useUpdateInvoiceMutation();
  const [sendInvoice, sendState] = useSendInvoiceMutation();
  const [recordPayment, paymentState] = useRecordInvoicePaymentMutation();
  const [cancelInvoice, cancelState] = useCancelInvoiceMutation();
  const [deleteInvoice, deleteState] = useDeleteInvoiceMutation();

  const saving = createState.isLoading || updateState.isLoading;
  const detail = detailData?.invoice ?? null;
  const detailOrg = detailData?.organization ?? null;

  useEffect(() => {
    if (routeId) setDetailId(routeId);
  }, [routeId]);

  const invoices = useMemo(() => {
    const list = data?.invoices ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter((invoice) =>
      [invoice.number, invoice.project?.name, invoice.project?.code, invoice.client?.companyName, invoice.client?.userId?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [data, search]);

  const metrics = useMemo(
    () => ({
      billed: summary?.billed ?? 0,
      collected: summary?.collected ?? 0,
      outstanding: summary?.outstanding ?? 0,
      overdue: summary?.overdue ?? 0,
    }),
    [summary]
  );

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm(),
      project: projectFilter || "",
      taxRate: organization?.taxRate ?? 18,
      terms: organization?.invoiceTerms || "",
    });
    setFormError("");
    setDialogOpen(true);
  };

  const openEdit = (invoice) => {
    setEditing(invoice);
    setForm({
      project: invoice.project?._id || invoice.project || "",
      issueDate: dateInput(invoice.issueDate),
      dueDate: dateInput(invoice.dueDate),
      discountAmount: invoice.discountAmount ?? 0,
      taxRate: invoice.taxRate ?? 18,
      notes: invoice.notes || "",
      terms: invoice.terms || "",
      lineItems: (invoice.lineItems || []).map((item) => ({
        description: item.description || "",
        quantity: item.quantity ?? 1,
        unit: item.unit || "Item",
        rate: item.rate ?? 0,
      })),
    });
    setFormError("");
    setDialogOpen(true);
  };

  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const updateLine = (index, field, value) =>
    setForm((current) => ({
      ...current,
      lineItems: current.lineItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));

  const addLine = () => setForm((current) => ({ ...current, lineItems: [...current.lineItems, emptyLine()] }));
  const removeLine = (index) =>
    setForm((current) => ({
      ...current,
      lineItems: current.lineItems.filter((_, itemIndex) => itemIndex !== index),
    }));

  const totals = useMemo(() => invoiceTotals(form), [form]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    const lines = form.lineItems
      .filter((item) => item.description.trim() && toNumber(item.quantity) > 0)
      .map((item) => ({
        description: item.description.trim(),
        quantity: toNumber(item.quantity),
        unit: item.unit,
        rate: toNumber(item.rate),
      }));
    if (!form.project) {
      setFormError("Choose the project being invoiced.");
      return;
    }
    if (lines.length === 0) {
      setFormError("Add at least one line item with a description and quantity.");
      return;
    }
    if (new Date(form.dueDate) < new Date(form.issueDate)) {
      setFormError("The due date must be on or after the issue date.");
      return;
    }
    const payload = {
      project: form.project,
      issueDate: form.issueDate,
      dueDate: form.dueDate,
      lineItems: lines,
      discountAmount: toNumber(form.discountAmount),
      taxRate: toNumber(form.taxRate),
      notes: form.notes,
      terms: form.terms,
    };
    try {
      if (editing) {
        await updateInvoice({ id: editing._id, ...payload }).unwrap();
      } else {
        const created = await createInvoice(payload).unwrap();
        setDetailId(created?.invoice?._id || null);
      }
      setDialogOpen(false);
    } catch (submitError) {
      setFormError(getErrorMessage(submitError, "The invoice could not be saved."));
    }
  };

  const runSend = async (invoice) => {
    setError("");
    try {
      await sendInvoice(invoice._id).unwrap();
    } catch (sendError) {
      setError(getErrorMessage(sendError));
    }
  };

  const openPayment = (invoice) => {
    setPaymentFor(invoice);
    setPayment({
      amount: Math.max(0, toNumber(invoice.total) - toNumber(invoice.amountPaid)).toFixed(2),
      date: dateInput(new Date()),
      method: "Bank Transfer",
      reference: "",
    });
    setPaymentError("");
  };

  const onSubmitPayment = async (event) => {
    event.preventDefault();
    setPaymentError("");
    if (!(Number(payment.amount) > 0)) {
      setPaymentError("Enter a payment amount greater than zero.");
      return;
    }
    try {
      await recordPayment({ id: paymentFor._id, ...payment, amount: Number(payment.amount) }).unwrap();
      setPaymentFor(null);
    } catch (paymentFailure) {
      setPaymentError(getErrorMessage(paymentFailure, "The payment could not be recorded."));
    }
  };

  const onCancelInvoice = async () => {
    if (!cancelReason.trim()) return;
    try {
      await cancelInvoice({ id: cancelling._id, reason: cancelReason.trim() }).unwrap();
      setCancelling(null);
      setCancelReason("");
      setDetailId(null);
    } catch (cancelError) {
      setError(getErrorMessage(cancelError));
      setCancelling(null);
    }
  };

  const onDelete = async () => {
    try {
      await deleteInvoice(confirm.target).unwrap();
      confirm.close();
      setDetailId(null);
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
      confirm.close();
    }
  };

  const onExport = async () => {
    setError("");
    try {
      await downloadExport("/invoice/export", "invoices.csv");
    } catch (exportError) {
      setError(getErrorMessage(exportError, "The export could not be downloaded."));
    }
  };

  const canCancel = (invoice) =>
    admin &&
    invoice.status !== "Cancelled" &&
    invoice.status !== "Paid" &&
    !(invoice.payments?.length > 0);

  return (
    <>
      <PageHeader
        title={admin ? "Invoices" : "My Invoices"}
        description={
          admin
            ? "Client billing, payments and outstanding receivables. Status is derived from the money and the due date."
            : "Invoices issued to you, with payments and the outstanding balance."
        }
        actions={
          admin ? (
            <>
              <Button variant="outline" onClick={onExport}>
                <LuDownload className="h-4 w-4" aria-hidden="true" /> Export CSV
              </Button>
              <Button variant="accent" onClick={openCreate}>
                <LuPlus className="h-4 w-4" aria-hidden="true" /> New Invoice
              </Button>
            </>
          ) : null
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 sm:mb-5">
        <StatCard icon={LuFileText} label="Billed" value={formatINRCompact(metrics.billed)} tone="navy" />
        <StatCard icon={LuCheckCircle2} label="Collected" value={formatINRCompact(metrics.collected)} tone="success" />
        <StatCard icon={LuClock} label="Outstanding" value={formatINRCompact(metrics.outstanding)} tone={metrics.outstanding ? "warning" : "success"} />
        <StatCard icon={LuXCircle} label="Overdue" value={formatINRCompact(metrics.overdue)} tone={metrics.overdue ? "danger" : "success"} />
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
                placeholder="Search invoices"
                aria-label="Search invoices"
                className="w-full rounded-md border border-concrete-300 bg-white py-2 pl-9 pr-3 text-sm text-navy-900 placeholder:text-concrete-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-400"
              />
            </div>
            {admin && (
              <Select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} aria-label="Filter by project" className="sm:!w-56">
                <option value="">All projects</option>
                {reference.projects.map((project) => (
                  <option key={project._id} value={project._id}>{projectName(project)}</option>
                ))}
              </Select>
            )}
          </div>
          <FilterChips options={STATUS_FILTERS.filter((item) => admin || item.value !== "Draft")} value={status} onChange={setStatus} ariaLabel="Filter invoices by status" />
        </div>

        {isLoading ? (
          <CardBody><p className="py-8 text-center text-sm text-concrete-500">Loading invoices…</p></CardBody>
        ) : loadError ? (
          <EmptyState title="Could not load invoices" description={getErrorMessage(loadError)} action={<Button variant="outline" onClick={refetch}>Try again</Button>} />
        ) : invoices.length === 0 ? (
          <EmptyState icon={LuFileText} title={search || status ? "No matching invoices" : "No invoices yet"} description={admin ? "Raise an invoice against a project with a linked client." : "Invoices issued to you will appear here."} action={admin ? <Button variant="accent" onClick={openCreate}>Create an invoice</Button> : null} />
        ) : (
          <ul className="divide-y divide-concrete-100">
            {invoices.map((invoice) => {
              const outstanding = Math.max(0, toNumber(invoice.total) - toNumber(invoice.amountPaid));
              return (
                <li key={invoice._id} className="px-4 py-3.5 sm:px-5">
                  <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setDetailId(invoice._id)}>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-sm font-semibold text-navy-900">{invoice.number}</p>
                        <StatusBadge status={invoice.status} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-concrete-500">
                        <span>{projectName(invoice.project)}</span>
                        {admin && <span>{clientName(invoice.client)}</span>}
                        <span>Issued {formatDate(invoice.issueDate)}</span>
                        <span>Due {formatDate(invoice.dueDate)}</span>
                      </div>
                    </button>
                    <div className="text-right">
                      <p className="font-display text-base font-semibold tabular-nums text-navy-900">{formatINR(invoice.total)}</p>
                      <p className={`text-xs tabular-nums ${outstanding > 0 ? "text-warning-700" : "text-success-700"}`}>
                        {outstanding > 0 ? `${formatINR(outstanding)} due` : "Fully paid"}
                      </p>
                    </div>
                    <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-1 sm:w-auto">
                      <Button variant="outline" size="sm" onClick={() => setDetailId(invoice._id)}>View</Button>
                      {admin && invoice.status === "Draft" && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => openEdit(invoice)}>Edit</Button>
                          <Button variant="accent" size="sm" loading={sendState.isLoading} onClick={() => runSend(invoice)}>Send</Button>
                        </>
                      )}
                      {admin && ["Sent", "Partially Paid", "Overdue"].includes(invoice.status) && (
                        <Button variant="primary" size="sm" onClick={() => openPayment(invoice)}>Payment</Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Invoice detail */}
      <Modal
        open={Boolean(detailId)}
        onClose={() => setDetailId(null)}
        title={detail ? `Invoice ${detail.number}` : "Invoice"}
        description={detail ? `${projectName(detail.project)} · ${formatDate(detail.issueDate)}` : undefined}
        size="lg"
        footer={
          detail ? (
            <>
              <Button variant="outline" onClick={() => window.print()}>
                <LuPrinter className="h-4 w-4" aria-hidden="true" /> Print
              </Button>
              {admin && detail.status === "Draft" && (
                <>
                  <Button variant="outline" onClick={() => { setDetailId(null); openEdit(detail); }}>Edit</Button>
                  <Button variant="accent" loading={sendState.isLoading} onClick={() => runSend(detail)}>Send invoice</Button>
                </>
              )}
              {admin && ["Sent", "Partially Paid", "Overdue"].includes(detail.status) && (
                <Button variant="primary" onClick={() => openPayment(detail)}>Record payment</Button>
              )}
              {canCancel(detail) && (
                <Button variant="danger-outline" onClick={() => { setCancelling(detail); setCancelReason(""); }}>Cancel</Button>
              )}
              {admin && detail.status === "Draft" && (
                <Button variant="ghost" size="icon" aria-label="Delete draft invoice" onClick={() => confirm.open(detail._id)}>
                  <LuTrash2 className="h-4 w-4 text-danger-600" />
                </Button>
              )}
            </>
          ) : null
        }
      >
        {detailLoading ? (
          <p className="py-8 text-center text-sm text-concrete-500">Loading invoice…</p>
        ) : detailError ? (
          <Alert variant="error">{getErrorMessage(detailError)}</Alert>
        ) : detail ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg font-semibold uppercase tracking-wide text-navy-900">{detailOrg?.name || "Invoice"}</p>
                {detailOrg?.address && <p className="mt-1 max-w-sm text-xs leading-relaxed text-concrete-500">{detailOrg.address}</p>}
                {detailOrg?.gstin && <p className="text-xs text-concrete-500">GSTIN {detailOrg.gstin}</p>}
              </div>
              <div className="text-right">
                <StatusBadge status={detail.status} />
                <p className="mt-2 text-xs text-concrete-500">Invoice date {formatDate(detail.issueDate)}</p>
                <p className="text-xs text-concrete-500">Due {formatDate(detail.dueDate)}</p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 rounded-md bg-concrete-50 p-3 text-sm sm:grid-cols-4">
              <div><dt className="text-xs text-concrete-500">Project</dt><dd className="mt-1 text-navy-900">{detail.project?.code || projectName(detail.project)}</dd></div>
              <div><dt className="text-xs text-concrete-500">Billed to</dt><dd className="mt-1 text-navy-900">{clientName(detail.client)}</dd></div>
              <div><dt className="text-xs text-concrete-500">Total</dt><dd className="mt-1 font-semibold text-navy-900">{formatINR(detail.total)}</dd></div>
              <div><dt className="text-xs text-concrete-500">Outstanding</dt><dd className="mt-1 font-semibold text-warning-700">{formatINR(Math.max(0, detail.total - detail.amountPaid))}</dd></div>
            </dl>

            <div className="overflow-x-auto rounded-md border border-concrete-200">
              <table className="min-w-full divide-y divide-concrete-200 text-sm">
                <thead className="bg-concrete-50 text-left">
                  <tr>
                    {["Description", "Qty", "Rate", "Amount"].map((heading) => (
                      <th key={heading} className="whitespace-nowrap px-3 py-2 font-display text-2xs font-semibold uppercase tracking-wider text-concrete-500">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-concrete-100">
                  {(detail.lineItems || []).map((item) => (
                    <tr key={item._id || item.description}>
                      <td className="px-3 py-2 text-navy-900">{item.description}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-concrete-600">{item.quantity} {item.unit}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-concrete-600">{formatINR(item.rate)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-navy-900">{formatINR(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="ml-auto max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between gap-6"><dt className="text-concrete-500">Subtotal</dt><dd className="tabular-nums text-navy-900">{formatINR(detail.subtotal)}</dd></div>
              {detail.discountAmount > 0 && (
                <div className="flex justify-between gap-6"><dt className="text-concrete-500">Discount</dt><dd className="tabular-nums text-navy-900">− {formatINR(detail.discountAmount)}</dd></div>
              )}
              <div className="flex justify-between gap-6"><dt className="text-concrete-500">Tax ({detail.taxRate}%)</dt><dd className="tabular-nums text-navy-900">{formatINR(detail.taxAmount)}</dd></div>
              <div className="flex justify-between gap-6 border-t border-concrete-200 pt-1.5 font-semibold"><dt className="text-navy-900">Total</dt><dd className="tabular-nums text-navy-900">{formatINR(detail.total)}</dd></div>
              <div className="flex justify-between gap-6"><dt className="text-concrete-500">Paid</dt><dd className="tabular-nums text-success-700">{formatINR(detail.amountPaid)}</dd></div>
            </dl>

            {detail.payments?.length > 0 && (
              <section>
                <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-concrete-500">Payments received</h3>
                <ul className="mt-1 divide-y divide-concrete-100 rounded-md border border-concrete-200">
                  {detail.payments.map((item) => (
                    <li key={item._id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0 text-concrete-600">
                        {formatDateTime(item.date)} · {item.method}
                        {item.reference ? ` · ${item.reference}` : ""}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-success-700">{formatINR(item.amount)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {detail.notes && <p className="text-sm text-concrete-600"><span className="font-semibold text-navy-800">Notes: </span>{detail.notes}</p>}
            {detail.terms && <p className="text-xs text-concrete-500"><span className="font-semibold text-navy-700">Terms: </span>{detail.terms}</p>}
          </div>
        ) : null}
      </Modal>

      {/* Create / edit */}
      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? "Edit invoice" : "New invoice"}
        description="Totals are recalculated by the server on save."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="accent" form="invoice-form" type="submit" loading={saving}>
              {editing ? "Save changes" : "Create draft"}
            </Button>
          </>
        }
      >
        <form id="invoice-form" onSubmit={onSubmit} className="space-y-4">
          {formError && <Alert variant="error">{formError}</Alert>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Project" value={form.project} onChange={update("project")} required disabled={Boolean(editing)}>
              <option value="">Select a project</option>
              {reference.projects.map((project) => (
                <option key={project._id} value={project._id}>{project.code} · {projectName(project)}</option>
              ))}
            </Select>
            <Input label="Issue date" type="date" value={form.issueDate} onChange={update("issueDate")} required />
            <Input label="Due date" type="date" value={form.dueDate} onChange={update("dueDate")} required />
            <Input label="Tax rate (%)" type="number" min="0" max="100" step="0.01" value={form.taxRate} onChange={update("taxRate")} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-display text-xs font-semibold uppercase tracking-wider text-navy-700">Line items</p>
              <Button variant="outline" size="sm" onClick={addLine}>Add line</Button>
            </div>
            <ul className="space-y-2">
              {form.lineItems.map((item, index) => (
                <li key={index} className="grid grid-cols-1 gap-2 rounded-md border border-concrete-200 p-2 sm:grid-cols-[1fr_5rem_5rem_6rem_auto]">
                  <Input aria-label="Description" placeholder="Description" value={item.description} onChange={(event) => updateLine(index, "description", event.target.value)} />
                  <Input aria-label="Quantity" type="number" min="0" step="0.01" value={item.quantity} onChange={(event) => updateLine(index, "quantity", event.target.value)} />
                  <Input aria-label="Unit" placeholder="Unit" value={item.unit} onChange={(event) => updateLine(index, "unit", event.target.value)} />
                  <Input aria-label="Rate" type="number" min="0" step="0.01" value={item.rate} onChange={(event) => updateLine(index, "rate", event.target.value)} />
                  <Button variant="ghost" size="icon" aria-label="Remove line" onClick={() => removeLine(index)} disabled={form.lineItems.length === 1}>
                    <LuTrash2 className="h-4 w-4 text-danger-600" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Discount (₹)" type="number" min="0" step="0.01" value={form.discountAmount} onChange={update("discountAmount")} />
            <div className="flex flex-col justify-end rounded-md bg-concrete-50 p-3 text-sm">
              <div className="flex justify-between gap-4"><span className="text-concrete-500">Subtotal</span><span className="tabular-nums text-navy-900">{formatINR(totals.subtotal)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-concrete-500">Tax</span><span className="tabular-nums text-navy-900">{formatINR(totals.tax)}</span></div>
              <div className="mt-1 flex justify-between gap-4 border-t border-concrete-200 pt-1 font-semibold"><span className="text-navy-900">Total</span><span className="tabular-nums text-navy-900">{formatINR(totals.total)}</span></div>
            </div>
          </div>

          <Textarea label="Notes" rows={2} value={form.notes} onChange={update("notes")} />
          <Textarea label="Terms" rows={2} value={form.terms} onChange={update("terms")} />
        </form>
      </Modal>

      {/* Payment */}
      <Modal
        open={Boolean(paymentFor)}
        onClose={() => setPaymentFor(null)}
        title="Record payment"
        description={paymentFor ? `${paymentFor.number} · ${formatINR(paymentFor.total - paymentFor.amountPaid)} outstanding` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setPaymentFor(null)}>Cancel</Button>
            <Button variant="accent" form="payment-form" type="submit" loading={paymentState.isLoading}>Record payment</Button>
          </>
        }
      >
        <form id="payment-form" onSubmit={onSubmitPayment} className="space-y-4">
          {paymentError && <Alert variant="error">{paymentError}</Alert>}
          <Input label="Amount (₹)" type="number" min="0.01" step="0.01" value={payment.amount} onChange={(event) => setPayment((current) => ({ ...current, amount: event.target.value }))} required />
          <Input label="Payment date" type="date" value={payment.date} onChange={(event) => setPayment((current) => ({ ...current, date: event.target.value }))} />
          <Select label="Method" value={payment.method} onChange={(event) => setPayment((current) => ({ ...current, method: event.target.value }))}>
            {PAYMENT_METHODS.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
          <Input label="Reference" value={payment.reference} onChange={(event) => setPayment((current) => ({ ...current, reference: event.target.value }))} placeholder="UTR, cheque no. or receipt" />
        </form>
      </Modal>

      {/* Cancel */}
      <Modal
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title="Cancel invoice"
        description="A cancelled invoice stays on record but is excluded from receivables."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelling(null)}>Keep invoice</Button>
            <Button variant="danger" onClick={onCancelInvoice} loading={cancelState.isLoading} disabled={!cancelReason.trim()}>
              Cancel invoice
            </Button>
          </>
        }
      >
        <label htmlFor="invoice-cancel-reason" className="mb-1.5 block font-display text-xs font-semibold uppercase tracking-wider text-navy-700">Reason</label>
        <textarea
          id="invoice-cancel-reason"
          rows={3}
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
          className="block w-full rounded-md border border-concrete-300 px-3 py-2 text-sm text-navy-900 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-400"
        />
      </Modal>

      <ConfirmDialog
        open={confirm.confirmOpen}
        onCancel={confirm.close}
        onConfirm={onDelete}
        title="Delete this draft invoice?"
        description="Only a draft can be deleted. Issued invoices must be cancelled instead."
        confirmLabel="Delete draft"
        loading={deleteState.isLoading}
      />
    </>
  );
};

export default Invoices;

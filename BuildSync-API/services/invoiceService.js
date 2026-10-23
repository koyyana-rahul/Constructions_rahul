import Invoice from "../models/Invoice.js";

/**
 * Invoice status is derived from money and dates, never typed by a user.
 *
 * `Sent` and `Partially Paid` invoices that pass their due date become
 * `Overdue`. The refresh is a single conditional `updateMany`, so it is safe to
 * call before any read that reports receivables.
 */
export const deriveInvoiceStatus = ({ amountPaid, total, dueDate, current = "Draft" }) => {
  if (["Draft", "Cancelled"].includes(current)) return current;

  const paid = Number(amountPaid) || 0;
  const billed = Number(total) || 0;

  if (billed > 0 && paid >= billed) return "Paid";
  if (dueDate && new Date(dueDate) < new Date()) return "Overdue";
  if (paid > 0) return "Partially Paid";
  return "Sent";
};

export const refreshOverdueInvoices = async () => {
  const now = new Date();
  await Invoice.updateMany(
    {
      status: { $in: ["Sent", "Partially Paid"] },
      dueDate: { $lt: now },
      $expr: { $lt: ["$amountPaid", "$total"] },
    },
    { $set: { status: "Overdue" } }
  );
};

export default { deriveInvoiceStatus, refreshOverdueInvoices };

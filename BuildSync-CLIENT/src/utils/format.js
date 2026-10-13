/**
 * Shared currency + number formatting.
 *
 * Payroll was previously rendered with a literal `$`, which is wrong for this
 * application and easy to misread as an actual payment record. Everything
 * monetary now goes through these helpers so the currency and the rounding
 * rule are defined exactly once.
 *
 * Note on wording: the backend stores *configured salary records*. There are no
 * payment records, so nothing here should be labelled "paid".
 */

const toAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

/** Full INR amount, e.g. `₹1,23,456`. */
export const formatINR = (value, decimals = 0) => {
  const amount = toAmount(value);
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  } catch {
    return `₹${amount.toLocaleString("en-IN")}`;
  }
};

/** Compact INR for KPI tiles, e.g. `₹1.2L`. */
export const formatINRCompact = (value) => {
  const amount = toAmount(value);
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  } catch {
    return formatINR(amount);
  }
};
const DetailField = ({ label, value, className = "" }) => (
  <div className={className}>
    <dt className="font-display text-2xs font-semibold uppercase tracking-wider text-concrete-500">
      {label}
    </dt>
    <dd className="mt-1 break-words text-sm text-navy-900">{value ?? "—"}</dd>
  </div>
);

/**
 * Two-column key/value grid for the read-only detail pages
 * (employee profile, client profile).
 */
const DetailList = ({ children, columns = 2, className = "" }) => (
  <dl
    className={`grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 ${
      columns === 3 ? "lg:grid-cols-3" : ""
    } ${className}`}
  >
    {children}
  </dl>
);

export { DetailField };
export default DetailList;
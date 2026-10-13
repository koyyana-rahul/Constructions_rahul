import { useState } from "react";
import { LuCheck, LuX, LuHeartPulse, LuCalendarDays } from "react-icons/lu";
import { api, getErrorMessage } from "../lib/api";
import { useMutation } from "../hooks/useQuery";
import { StatusBadge } from "../components/ui/Badge";

export const columns = [
  {
    name: "#",
    selector: (row) => row.sno,
    width: "64px",
    cell: (row) => (
      <span className="font-display text-xs tabular-nums text-concrete-400">
        {String(row.sno).padStart(2, "0")}
      </span>
    ),
  },
  {
    name: "Employee",
    selector: (row) => row.name,
    sortable: true,
    cell: (row) => (
      <div className="min-w-0">
        <p className="truncate font-display font-semibold text-navy-900">{row.name}</p>
        <p className="font-mono text-2xs text-concrete-500">{row.employeeId}</p>
      </div>
    ),
  },
  {
    name: "Construction Site",
    selector: (row) => row.department,
    cell: (row) => (
      <span className="font-display text-xs font-semibold uppercase tracking-wide text-navy-700">
        {row.department}
      </span>
    ),
  },
  {
    name: "Status",
    selector: (row) => row.status,
    width: "130px",
    cell: (row) =>
      row.status ? <StatusBadge status={row.status} /> : <StatusBadge tone="neutral">Not marked</StatusBadge>,
  },
  {
    name: "Mark",
    selector: (row) => row.action,
    style: { justifyContent: "center" },
    width: "300px",
  },
];

const MARK_OPTIONS = [
  { value: "Present", label: "Present", Icon: LuCheck, tone: "success" },
  { value: "Absent", label: "Absent", Icon: LuX, tone: "danger" },
  { value: "Sick", label: "Sick", Icon: LuHeartPulse, tone: "info" },
  { value: "Leave", label: "Leave", Icon: LuCalendarDays, tone: "warning" },
];

const TONES = {
  success:
    "border-success-500/40 bg-success-50 text-success-700 hover:bg-success-100 hover:border-success-500",
  danger: "border-danger-500/40 bg-danger-50 text-danger-700 hover:bg-danger-100 hover:border-danger-500",
  info: "border-info-500/40 bg-info-50 text-info-700 hover:bg-info-100 hover:border-info-500",
  warning:
    "border-warning-500/40 bg-warning-50 text-warning-700 hover:bg-warning-100 hover:border-warning-500",
};

/** Per-employee attendance marking. Values match the backend's expected statuses. */
export const AttendanceHelper = ({ status, employeeId, statusChange }) => {
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  // Refreshing the list after the server confirms the mark keeps every
  // summary on the page in step - no manual refresh required.
  const { mutate: markEmployee } = useMutation(
    async (value) => {
      const { data } = await api.put(`/attendance/update/${employeeId}`, { status: value });
      if (!data.success) throw new Error("Could not save attendance.");
      return data;
    },
    { invalidate: ["attendance", "dashboard-summary"] }
  );

  const run = async (value) => {
    setError(null);
    setPending(true);
    try {
      await markEmployee(value);
      statusChange?.();
    } catch (err) {
      setError(getErrorMessage(err, "Could not save attendance."));
    } finally {
      setPending(false);
    }
  };

  if (status != null) {
    return <StatusBadge status={status} />;
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="inline-flex items-center justify-center gap-1 rounded-md bg-concrete-100 p-1"
        role="group"
        aria-label="Mark attendance"
      >
        {MARK_OPTIONS.map(({ value, label, Icon, tone }) => (
          <button
            key={value}
            type="button"
            disabled={pending}
            onClick={() => run(value)}
            title={`Mark as ${label}`}
            aria-label={`Mark as ${label}`}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded border px-2 py-1.5 font-display text-2xs font-semibold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              TONES[tone]
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      {error && (
        <span role="alert" className="max-w-[14rem] text-center text-2xs text-danger-600">
          {error}
        </span>
      )}
    </div>
  );
};
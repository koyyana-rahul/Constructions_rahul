import { useNavigate } from "react-router-dom";
import { LuEye } from "react-icons/lu";
import { IconAction, RowActions, formatDate } from "./tableUtils";
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
    name: "Emp ID",
    selector: (row) => row.employeeId,
    width: "120px",
    cell: (row) => <span className="font-mono text-xs text-navy-700">{row.employeeId}</span>,
  },
  {
    name: "Employee",
    selector: (row) => row.name,
    sortable: true,
    cell: (row) => (
      <span className="font-display font-semibold text-navy-900">{row.name}</span>
    ),
  },
  {
    name: "Leave Type",
    selector: (row) => row.leaveType,
    cell: (row) => (
      <span className="font-display text-xs font-semibold uppercase tracking-wide text-navy-700">
        {row.leaveType}
      </span>
    ),
  },
  {
    name: "Site",
    selector: (row) => row.department,
    cell: (row) => (
      <span className="font-display text-xs font-semibold uppercase tracking-wide text-navy-700">
        {row.department}
      </span>
    ),
  },
  {
    name: "Dates",
    selector: (row) => row.startDate,
    cell: (row) => (
      // Each date stays intact and the arrow sits between them, so a narrow
      // column wraps to two lines instead of the arrow colliding with the
      // second date (which `whitespace-nowrap` on the whole range caused).
      <span className="tabular-nums leading-relaxed text-concrete-600">
        <span className="whitespace-nowrap">{formatDate(row.startDate)}</span>
        <span className="mx-1" aria-hidden="true">
          →
        </span>
        <span className="whitespace-nowrap">{formatDate(row.endDate)}</span>
      </span>
    ),
  },
  {
    name: "Days",
    selector: (row) => row.days,
    width: "80px",
    cell: (row) => <span className="tabular-nums">{row.days}</span>,
  },
  {
    name: "Status",
    selector: (row) => row.status,
    width: "120px",
    cell: (row) => <StatusBadge status={row.status} />,
  },
  {
    name: "Actions",
    selector: (row) => row.action,
    style: { justifyContent: "center" },
    width: "80px",
  },
];

export const LeaveButtons = ({ Id }) => {
  const navigate = useNavigate();
  return (
    <RowActions>
      <IconAction title="View leave request" onClick={() => navigate(`/admin-dashboard/leaves/${Id}`)}>
        <LuEye className="h-4 w-4" aria-hidden="true" />
      </IconAction>
    </RowActions>
  );
};
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
    name: "Request",
    selector: (row) => row.name,
    sortable: true,
    cell: (row) => (
      <span className="font-display font-semibold text-navy-900">{row.name}</span>
    ),
  },
  {
    name: "Client",
    selector: (row) => row.clientName,
    sortable: true,
    cell: (row) => (
      <div className="min-w-0">
        <p className="truncate text-sm text-navy-800">{row.clientName}</p>
        <p className="font-mono text-2xs text-concrete-500">{row.clientPhone || "—"}</p>
      </div>
    ),
  },
  {
    name: "Entity",
    selector: (row) => row.entityType,
    width: "130px",
    cell: (row) => <StatusBadge status={row.entityType} />,
  },
  {
    name: "Duration",
    selector: (row) => row.startDate,
    cell: (row) => (
      <span className="whitespace-nowrap tabular-nums text-concrete-600">
        {formatDate(row.startDate)} → {formatDate(row.endDate)}
      </span>
    ),
  },
  {
    name: "Applied",
    selector: (row) => row.appliedAt,
    cell: (row) => <span className="tabular-nums">{formatDate(row.appliedAt)}</span>,
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

export const WorkRequestButtons = ({ Id }) => {
  const navigate = useNavigate();
  return (
    <RowActions>
      <IconAction
        title="View work request"
        onClick={() => navigate(`/admin-dashboard/work/${Id}`)}
      >
        <LuEye className="h-4 w-4" aria-hidden="true" />
      </IconAction>
    </RowActions>
  );
};
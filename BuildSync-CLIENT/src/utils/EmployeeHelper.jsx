import { useNavigate } from "react-router-dom";
import { LuEye, LuPencil, LuWallet, LuCalendarDays, LuCalendarCheck } from "react-icons/lu";
import { IconAction, RowActions, formatDate } from "./tableUtils";
import Avatar from "../components/ui/Avatar";

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
      <div className="flex items-center gap-3">
        <Avatar src={row.profileImage} name={row.name} size="sm" />
        <div className="min-w-0">
          <p className="truncate font-display font-semibold text-navy-900">{row.name}</p>
          <p className="truncate font-mono text-2xs text-concrete-500">{row.employeeId}</p>
        </div>
      </div>
    ),
  },
  {
    name: "Site",
    selector: (row) => row.dep_name,
    cell: (row) => (
      <span className="font-display text-xs font-semibold uppercase tracking-wide text-navy-700">
        {row.dep_name || "—"}
      </span>
    ),
  },
  {
    name: "Designation",
    selector: (row) => row.designation,
    cell: (row) => row.designation || "—",
  },
  {
    name: "DOB",
    selector: (row) => row.dob,
    sortable: true,
    cell: (row) => <span className="tabular-nums">{formatDate(row.dob)}</span>,
  },
  {
    name: "Actions",
    selector: (row) => row.action,
    style: { justifyContent: "center" },
    width: "220px",
  },
];

/**
 * Row actions.
 *
 * Every destination carries the employee's `Employee._id` in the URL, which is
 * the same identifier the leave / payroll / attendance endpoints scope by. The
 * employee context header therefore survives a refresh and a pasted link.
 */
export const EmployeeButtons = ({ Id, name }) => {
  const navigate = useNavigate();

  return (
    <RowActions label={`Actions for ${name || "employee"}`}>
      <IconAction title="View profile" onClick={() => navigate(`/admin-dashboard/employees/${Id}`)}>
        <LuEye className="h-4 w-4" aria-hidden="true" />
      </IconAction>
      <IconAction
        title="Edit employee"
        onClick={() => navigate(`/admin-dashboard/employees/edit/${Id}`)}
      >
        <LuPencil className="h-4 w-4" aria-hidden="true" />
      </IconAction>
      <IconAction
        title="Salary"
        tone="accent"
        onClick={() => navigate(`/admin-dashboard/employees/salary/${Id}`)}
      >
        <LuWallet className="h-4 w-4" aria-hidden="true" />
      </IconAction>
      <IconAction
        title="Leave requests"
        tone="neutral"
        onClick={() => navigate(`/admin-dashboard/employees/leaves/${Id}`)}
      >
        <LuCalendarDays className="h-4 w-4" aria-hidden="true" />
      </IconAction>
      <IconAction
        title="Attendance"
        tone="neutral"
        onClick={() => navigate(`/admin-dashboard/employees/attendance/${Id}`)}
      >
        <LuCalendarCheck className="h-4 w-4" aria-hidden="true" />
      </IconAction>
    </RowActions>
  );
};
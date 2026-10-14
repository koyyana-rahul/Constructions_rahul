import { useNavigate } from "react-router-dom";
import { LuPencil, LuArchive, LuArchiveRestore } from "react-icons/lu";
import { IconAction, RowActions } from "./tableUtils";
import { StatusBadge } from "../components/ui/Badge";
import ConfirmDialog, { useConfirm } from "../components/ui/ConfirmDialog";
import { useSetDepartmentArchivedMutation } from "../services/api/endpoints/departmentsApi";
import { getErrorMessage } from "../lib/api";

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
    name: "Site Name",
    selector: (row) => row.dep_name,
    sortable: true,
    cell: (row) => (
      <span className="font-display font-semibold uppercase tracking-wide text-navy-900">
        {row.dep_name}
      </span>
    ),
  },
  {
    name: "Description",
    selector: (row) => row.description,
    cell: (row) => (
      <span className="line-clamp-2 max-w-md text-concrete-600">
        {row.description || "—"}
      </span>
    ),
  },
  {
    name: "Status",
    selector: (row) => row.isArchived,
    width: "120px",
    cell: (row) => <StatusBadge status={row.isArchived ? "Archived" : "Active"} />,
  },
  {
    name: "Actions",
    selector: (row) => row.action,
    style: { justifyContent: "center" },
    width: "110px",
  },
];

/**
 * Archive / Restore instead of Delete.
 *
 * The API deliberately refuses a hard delete while historical records exist
 * ("Use the archive endpoint instead"), so the previous Delete button could
 * only ever fail. Archiving closes a site to new work and deactivates its
 * employees while retaining attendance, leave and payroll history.
 */
export const DepartmentButtons = ({ Id, name, isArchived }) => {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [setArchived, { isPending }] = useSetDepartmentArchivedMutation();

  const handleToggle = async () => {
    confirm.setLoading(true);
    try {
      await setArchived({ id: Id, archive: !isArchived }).unwrap();
      confirm.close();
    } catch {
      /* the message is rendered from the mutation error below */
    } finally {
      confirm.setLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-center gap-1">
        <RowActions>
          <IconAction
            title="Edit site"
            onClick={() => navigate(`/admin-dashboard/department/${Id}`)}
            disabled={isPending}
          >
            <LuPencil className="h-4 w-4" aria-hidden="true" />
          </IconAction>
          <IconAction
            title={isArchived ? "Restore site" : "Archive site"}
            tone={isArchived ? "accent" : "danger"}
            onClick={() => confirm.open(Id)}
            disabled={isPending}
          >
            {isArchived ? (
              <LuArchiveRestore className="h-4 w-4" aria-hidden="true" />
            ) : (
              <LuArchive className="h-4 w-4" aria-hidden="true" />
            )}
          </IconAction>
        </RowActions>
        {setArchived.error && (
          <span role="alert" className="max-w-[14rem] text-center text-2xs text-danger-600">
            {getErrorMessage(setArchived.error, "Could not update the site.")}
          </span>
        )}
      </div>

      <ConfirmDialog
        open={confirm.confirmOpen}
        loading={confirm.loading}
        variant={isArchived ? "primary" : "danger"}
        title={isArchived ? "Restore construction site" : "Archive construction site"}
        confirmLabel={isArchived ? "Restore site" : "Archive site"}
        onCancel={confirm.close}
        onConfirm={handleToggle}
      >
        <p className="text-sm leading-relaxed text-concrete-600">
          {isArchived ? (
            <>
              <span className="font-display font-semibold text-navy-900">{name}</span> will
              reopen for new work, and employees assigned to it will be reactivated.
            </>
          ) : (
            <>
              <span className="font-display font-semibold text-navy-900">{name}</span> will
              close to new work. Employees assigned to it will be deactivated and lose portal
              access. Attendance, leave and payroll records are retained.
            </>
          )}
        </p>
      </ConfirmDialog>
    </>
  );
};
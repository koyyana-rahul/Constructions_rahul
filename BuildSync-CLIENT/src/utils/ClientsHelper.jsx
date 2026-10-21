import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuEye, LuPencil, LuTrash2, LuSend } from "react-icons/lu";
import { IconAction, RowActions } from "./tableUtils";
import Avatar from "../components/ui/Avatar";
import ConfirmDialog, { useConfirm } from "../components/ui/ConfirmDialog";
import { StatusBadge } from "../components/ui/Badge";
import { useDeleteClientMutation } from "../services/api/endpoints/clientsApi";
import { useResendInvitationMutation } from "../services/api/endpoints/authApi";
import { getErrorMessage } from "../lib/api";

export const clientColumns = [
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
    name: "Client",
    selector: (row) => row.name,
    sortable: true,
    cell: (row) => (
      <div className="flex items-center gap-3">
        <Avatar src={row.profileImage} name={row.name} size="sm" />
        <div className="min-w-0">
          <p className="truncate font-display font-semibold text-navy-900">{row.name}</p>
          <p className="truncate text-2xs text-concrete-500">{row.email}</p>
        </div>
      </div>
    ),
  },
  {
    name: "Entity",
    selector: (row) => row.entityType,
    cell: (row) => <StatusBadge status={row.entityType} />,
  },
  {
    name: "Organisation",
    selector: (row) => row.companyName,
    cell: (row) => (
      <span className="font-display text-xs font-semibold uppercase tracking-wide text-navy-700">
        {row.companyName || "—"}
      </span>
    ),
  },
  {
    name: "Phone",
    selector: (row) => row.phone,
    cell: (row) => <span className="tabular-nums">{row.phone || "—"}</span>,
  },
  {
    name: "Account",
    selector: (row) => row.isActivated,
    width: "140px",
    cell: (row) =>
      row.isActivated ? (
        <StatusBadge status="active">Activated</StatusBadge>
      ) : (
        <StatusBadge status="pending">Awaiting setup</StatusBadge>
      ),
  },
  {
    name: "Actions",
    selector: (row) => row.action,
    style: { justifyContent: "center" },
    width: "140px",
  },
];

export const ClientButtons = ({ Id, name, userIdRef, isActivated }) => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [link, setLink] = useState(null);
  const confirm = useConfirm();

  const [deleteClient, deleteState] = useDeleteClientMutation();
  const [resendInvitation, resendState] = useResendInvitationMutation();

  const handleDelete = async () => {
    confirm.setLoading(true);
    setError(null);
    try {
      await deleteClient(Id).unwrap();
      confirm.close();
    } catch (err) {
      confirm.close();
      setError(getErrorMessage(err, "Could not delete the client."));
    } finally {
      confirm.setLoading(false);
    }
  };

  // Invited accounts that never activated need a fresh one-time link.
  const handleResend = async () => {
    setError(null);
    setLink(null);
    try {
      const result = await resendInvitation(userIdRef).unwrap();
      setLink(result.activationToken);
    } catch (err) {
      setError(getErrorMessage(err, "Could not issue a new invitation."));
    }
  };

  return (
    <>
      <div className="flex flex-col items-center gap-1">
        <RowActions label={`Actions for ${name || "client"}`}>
          <IconAction title="View client" onClick={() => navigate(`/admin-dashboard/clients/${Id}`)}>
            <LuEye className="h-4 w-4" aria-hidden="true" />
          </IconAction>
          <IconAction
            title="Edit client"
            onClick={() => navigate(`/admin-dashboard/clients/edit/${Id}`)}
          >
            <LuPencil className="h-4 w-4" aria-hidden="true" />
          </IconAction>
          {!isActivated && (
            <IconAction
              title="Resend invitation"
              tone="accent"
              onClick={handleResend}
              disabled={!userIdRef || resendState.isLoading}
            >
              <LuSend className="h-4 w-4" aria-hidden="true" />
            </IconAction>
          )}
          <IconAction
            title="Delete client"
            tone="danger"
            onClick={() => confirm.open(Id)}
            disabled={deleteState.isLoading}
          >
            <LuTrash2 className="h-4 w-4" aria-hidden="true" />
          </IconAction>
        </RowActions>

        {link && (
          <code className="max-w-[16rem] truncate rounded bg-accent-50 px-2 py-1 text-2xs text-accent-800">
            {`${window.location.origin}/activate?token=${link}`}
          </code>
        )}
        {error && (
          <span role="alert" className="max-w-[14rem] text-center text-2xs text-danger-600">
            {error}
          </span>
        )}
      </div>

      <ConfirmDialog
        open={confirm.confirmOpen}
        loading={confirm.loading}
        title="Delete client"
        description={
          name
            ? `"${name}" and their login account will be permanently removed.`
            : "This client and their login account will be permanently removed."
        }
        confirmLabel="Delete client"
        onCancel={confirm.close}
        onConfirm={handleDelete}
      />
    </>
  );
};
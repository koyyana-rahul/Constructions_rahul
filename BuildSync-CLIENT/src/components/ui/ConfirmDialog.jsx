import { useState } from "react";
import Modal from "./Modal";
import Button from "./Button";
import { LuAlertTriangle } from "react-icons/lu";

/**
 * Confirmation dialog for destructive actions.
 * Replaces the old blocking `window.confirm()`, which could not be styled and
 * was announced inconsistently across browsers.
 */
const ConfirmDialog = ({
  open,
  onCancel,
  onConfirm,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
  children,
}) => (
  <Modal
    open={open}
    onClose={onCancel}
    title={title}
    description={description}
    size="sm"
    footer={
      <>
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={variant} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className="flex items-start gap-3">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          variant === "danger" ? "bg-danger-50 text-danger-600" : "bg-warning-50 text-warning-600"
        }`}
      >
        <LuAlertTriangle className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        {children ??
          (variant === "danger" ? (
            <p className="text-sm leading-relaxed text-concrete-600">
              This action cannot be undone.
            </p>
          ) : null)}
      </div>
    </div>
  </Modal>
);

/** Manages open/closed/loading state for a single confirm action. */
export const useConfirm = () => {
  const [target, setTarget] = useState(null);
  const [loading, setLoading] = useState(false);

  return {
    confirmOpen: target !== null,
    target,
    loading,
    open: (value) => setTarget(value),
    close: () => {
      setTarget(null);
      setLoading(false);
    },
    setLoading,
  };
};

export default ConfirmDialog;
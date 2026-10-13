import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { LuX } from "react-icons/lu";

/**
 * Accessible dialog: rendered in a portal, closes on Escape and backdrop click,
 * traps initial focus and restores it on unmount.
 */
const Modal = ({ open, onClose, title, description, children, footer, size = "md" }) => {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocused.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);

    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 animate-fade-in bg-navy-950/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative flex max-h-[90vh] w-full flex-col ${widths[size]} animate-scale-in rounded-lg border border-concrete-200 bg-white shadow-popover outline-none`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-concrete-200 px-4 py-3.5 sm:gap-4 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold uppercase leading-tight tracking-wide text-navy-900 break-words">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm leading-relaxed text-concrete-600 break-words">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded p-1 text-concrete-400 transition-colors hover:bg-concrete-100 hover:text-navy-800"
          >
            <LuX className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer && (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-concrete-200 bg-concrete-50 px-4 py-3.5 sm:gap-3 sm:px-5 sm:py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
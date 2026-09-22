import React, { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import "./ConfirmModal.css";

/**
 * Reusable confirmation modal.
 *
 * Props:
 * - open: boolean — whether the modal is visible
 * - title: string
 * - message: string
 * - confirmLabel: string (default "Confirm")
 * - cancelLabel: string (default "Go Back")
 * - danger: boolean — styles the confirm button red instead of green
 * - onConfirm: () => void
 * - onCancel: () => void
 */
export function ConfirmModal({
  open,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Go Back",
  danger = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (e) => {
      if (e.key === "Escape") onCancel?.();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="sabi-confirm-overlay" onClick={onCancel}>
      <div
        className="sabi-confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sabi-confirm-title"
        aria-describedby="sabi-confirm-message"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={"sabi-confirm-icon" + (danger ? " sabi-confirm-icon-danger" : "")}>
          <AlertTriangle size={22} />
        </div>

        <h2 id="sabi-confirm-title" className="sabi-confirm-title">{title}</h2>
        {message && (
          <p id="sabi-confirm-message" className="sabi-confirm-message">{message}</p>
        )}

        <div className="sabi-confirm-actions">
          <button type="button" className="sabi-confirm-btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={"sabi-confirm-btn-primary" + (danger ? " sabi-confirm-btn-danger" : "")}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;

import React, { useEffect, useId, useRef } from "react";
import { Button } from "design-system";

export function Modal({
  open,
  title,
  description,
  children,
  actions,
  onClose,
  busy = false,
  size = "md",
  className = "",
}) {
  const dialogRef = useRef(null);
  const titleId = useId();

  // Effect 1: runs ONLY when the modal opens/closes.
  // Handles body scroll lock + initial focus. Does NOT depend on
  // `busy` or `onClose`, so it can never be re-triggered by an
  // inline handler getting a new reference on every parent re-render.
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusableSelector = [
      "button:not([disabled])",
      "[href]",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    const firstFocusable = dialogRef.current?.querySelectorAll(focusableSelector)?.[0];
    firstFocusable?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Effect 2: keydown listener (Escape + focus trap).
  // Safe to re-run on every render since it never calls .focus()
  // itself — it only reacts to actual Tab/Escape key presses.
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const focusableSelector = [
      "button:not([disabled])",
      "[href]",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    const handleKeyDown = (event) => {
      if (busy) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const elements = Array.from(dialogRef.current?.querySelectorAll(focusableSelector) || []);
      if (elements.length === 0) {
        event.preventDefault();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [busy, onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="sabi-modal-overlay" onClick={() => !busy && onClose?.()}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`sabi-modal ${size === "lg" ? "sabi-modal-lg" : ""} ${className}`.trim()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sabi-modal-head">
          <div>
            <h3 id={titleId}>{title}</h3>
            {description ? <p className="sabi-modal-description">{description}</p> : null}
          </div>
          <Button type="button" variant="secondary" className="sabi-modal-close-btn" onClick={onClose} disabled={busy} aria-label="Close dialog">
            ×
          </Button>
        </div>

        <div className="sabi-modal-body">{children}</div>

        {actions ? <div className="sabi-modal-actions">{actions}</div> : null}
      </div>
    </div>
  );
}

export default Modal;

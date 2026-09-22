import React, { useEffect } from "react";
import { X } from "lucide-react";

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="sabi-modal-overlay" onClick={onClose}>
      <div
        className={"sabi-modal" + (wide ? " wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sabi-modal-head">
          <h3>{title}</h3>
          <button type="button" className="sabi-modal-close" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="sabi-modal-body">{children}</div>
      </div>
    </div>
  );
}

export default Modal;

import React from "react";
import { Button } from "design-system";
import { Modal } from "./Modal";

export function ConfirmModal({ title, message, confirmLabel = "Confirm", onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="sabi-confirm-message">{message}</p>
      <div className="sabi-modal-actions">
        <Button type="button" variant="primary" onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}

export default ConfirmModal;

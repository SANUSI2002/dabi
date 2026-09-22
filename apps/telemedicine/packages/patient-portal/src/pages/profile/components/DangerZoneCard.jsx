import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "design-system";
import Modal from "../shared/Modal";

export function DangerZoneCard() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const closeToast = () => setToast("");

  const showToast = (message) => {
    setToast(message);
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(() => setToast(""), 2400);
  };

  const confirmDelete = () => {
    if (confirmationText !== "DELETE") {
      return;
    }

    setBusy(true);
    window.setTimeout(() => {
      localStorage.clear();
      sessionStorage.clear();
      setBusy(false);
      setOpen(false);
      setConfirmationText("");
      showToast("✅ Account deleted successfully.");
      navigate("/login", { replace: true });
    }, 800);
  };

  return (
    <>
      <div className="sabi-danger-zone">
        <div className="sabi-danger-zone-label">Danger Zone</div>
        <div className="sabi-danger-zone-card">
          <div>
            <div className="sabi-danger-zone-title">Delete Account</div>
            <p className="sabi-danger-zone-text">
              Once you delete your account, your entire medical history will be archived according to legal
              regulations and will no longer be accessible through this dashboard.
            </p>
          </div>
          <Button variant="danger" className="sabi-danger-zone-btn" onClick={() => setOpen(true)}>
            Permanently Delete Account
          </Button>
        </div>
      </div>

      <Modal
        open={open}
        title="Delete Your Account?"
        description="This action is permanent and cannot be undone. Deleting your account will permanently remove your personal information, medical records, appointments, prescriptions, and all associated data."
        onClose={() => {
          setOpen(false);
          setConfirmationText("");
        }}
        busy={busy}
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => {
              setOpen(false);
              setConfirmationText("");
            }} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={confirmDelete} disabled={busy || confirmationText !== "DELETE"}>
              {busy ? "Deleting..." : "Delete Account"}
            </Button>
          </>
        }
      >
        <div className="sabi-field">
          <label className="sabi-field-label">Type DELETE to confirm</label>
          <input
            className="sabi-field-input"
            value={confirmationText}
            onChange={(event) => setConfirmationText(event.target.value)}
            placeholder="DELETE"
          />
        </div>
      </Modal>

      {toast ? <div className="sabi-toast" onClick={closeToast}>{toast}</div> : null}
    </>
  );
}

export default DangerZoneCard;

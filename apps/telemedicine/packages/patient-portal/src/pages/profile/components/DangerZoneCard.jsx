import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "design-system";
import Modal from "../shared/Modal";
import { deleteAccount } from "../../../api/profileApi";
import { signOut } from "../../../utils/sabiIdentity";

export function DangerZoneCard() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    setOpen(false);
    setConfirmationText("");
    setError("");
  };

  const confirmDelete = async () => {
    if (confirmationText !== "DELETE") return;
    setBusy(true);
    setError("");
    try {
      await deleteAccount();
      // The server has already ended every session; this only clears the local copy.
      await signOut();
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <>
      <div className="sabi-danger-zone">
        <div className="sabi-danger-zone-label">Danger Zone</div>
        <div className="sabi-danger-zone-card">
          <div>
            <div className="sabi-danger-zone-title">Delete Account</div>
            <p className="sabi-danger-zone-text">
              Permanently deletes your Sabi Health account and the health information stored in it. Accounts linked to
              hospital enrollments, hospital appointments, wellness bookings or uploaded documents can&apos;t be deleted
              here, because those records must be kept — contact Sabi support instead.
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
        description="This is permanent and cannot be undone. Your personal details, medical records, vitals, appointments, prescriptions and settings will be deleted, and you will be signed out everywhere."
        onClose={close}
        busy={busy}
        actions={
          <>
            <Button type="button" variant="secondary" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={confirmDelete} disabled={busy || confirmationText !== "DELETE"}>
              {busy ? "Deleting..." : "Delete Account"}
            </Button>
          </>
        }
      >
        <div className="sabi-field">
          <label className="sabi-field-label" htmlFor="sabi-delete-confirm">Type DELETE to confirm</label>
          <input
            id="sabi-delete-confirm"
            className="sabi-field-input"
            value={confirmationText}
            onChange={(event) => setConfirmationText(event.target.value)}
            placeholder="DELETE"
            autoComplete="off"
          />
        </div>
        {error && <p className="sabi-field-error" role="alert">{error}</p>}
      </Modal>
    </>
  );
}

export default DangerZoneCard;

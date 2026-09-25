import React, { useState } from "react";
import { Card, Button } from "design-system";
import { Pill, CheckCircle2, Plus } from "lucide-react";
import { SectionTitle } from "../share";
import { useApiData } from "../../../api/useApiData";
import { addMedication, formatClock, listMedications, setMedicationTaken } from "../../../api/dashboardApi";

function AddMedicationForm({ onAdded, onCancel }) {
  const [name, setName] = useState("");
  const [time, setTime] = useState("08:00");
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await addMedication({ name, time, instructions });
      await onAdded();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <form className="sabi-med-form" onSubmit={submit}>
      <label>
        Medication
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amlodipine 5mg" maxLength={120} required autoFocus />
      </label>
      <div className="sabi-med-form-row">
        <label>
          Time
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </label>
        <label>
          Instructions (optional)
          <input value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. After breakfast" maxLength={500} />
        </label>
      </div>
      {error && <p className="sabi-form-error" role="alert">{error}</p>}
      <div className="sabi-med-form-actions">
        <Button type="submit" variant="primary" disabled={saving}>{saving ? "Adding…" : "Add"}</Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </form>
  );
}

export function MedicationsCard() {
  const { data: meds, error, reload } = useApiData(listMedications, []);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [adding, setAdding] = useState(false);
  const remaining = (meds || []).filter((m) => !m.isTaken).length;

  const markTaken = async (id) => {
    setBusyId(id);
    setActionError(null);
    try {
      await setMedicationTaken(id, true);
      await reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="sabi-med-card">
      <SectionTitle action={meds?.length ? `${remaining} remaining` : undefined}>Medications</SectionTitle>

      {error ? (
        <p className="sabi-dash-empty">{error.message}</p>
      ) : !meds ? (
        <p className="sabi-dash-empty">Loading your medications…</p>
      ) : (
        <div className="sabi-med-list">
          {meds.length === 0 && !adding && <p className="sabi-dash-empty">No medications added yet.</p>}
          {meds.map((m) =>
            !m.isTaken ? (
              <div className="sabi-med-featured" key={m.id}>
                <div className="sabi-med-featured-head">
                  <div>
                    <div className="sabi-med-name">{m.name}</div>
                    <div className="sabi-med-sub">{[formatClock(m.time), m.instructions].filter(Boolean).join(" · ")}</div>
                  </div>
                  <div className="sabi-med-icon">
                    <Pill size={15} />
                  </div>
                </div>
                <Button variant="primary" className="sabi-med-btn" onClick={() => markTaken(m.id)} disabled={busyId === m.id}>
                  {busyId === m.id ? "Saving…" : "Mark as Taken"}
                </Button>
              </div>
            ) : (
              <div className="sabi-med-item" key={m.id}>
                <div>
                  <div className="sabi-med-name">{m.name}</div>
                  <div className="sabi-med-sub">{formatClock(m.time)} · Taken</div>
                </div>
                <span className="sabi-med-taken-icon" aria-label="Taken">
                  <CheckCircle2 size={18} />
                </span>
              </div>
            ),
          )}
          {actionError && <p className="sabi-form-error" role="alert">{actionError}</p>}
          {adding ? (
            <AddMedicationForm
              onCancel={() => setAdding(false)}
              onAdded={async () => {
                setAdding(false);
                await reload();
              }}
            />
          ) : (
            <button type="button" className="sabi-dash-link" onClick={() => setAdding(true)}>
              <Plus size={14} style={{ verticalAlign: "-2px" }} /> Add medication
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

export default MedicationsCard;

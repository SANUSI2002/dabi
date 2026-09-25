import React, { useState } from "react";
import { Button } from "design-system";
import { Modal } from "./Modal";
import { RECORD_TYPES } from "../../../api/recordsApi";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Form for a patient-entered record. `fixedCategoryId` files it straight into that folder;
 * otherwise the patient may pick a folder (or leave it unfiled).
 */
export function RecordForm({ categories = [], fixedCategoryId, onSave, onCancel, submitLabel = "Save Record" }) {
  const [fields, setFields] = useState({
    title: "",
    recordType: "PHYSICAL",
    date: today(),
    facility: "",
    doctorName: "",
    diagnosis: "",
    treatment: "",
    notes: "",
    categoryId: fixedCategoryId || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (key) => (e) => setFields((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!fields.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(fields);
    } catch (err) {
      setError(err.errors?.map((x) => x.message).join(" ") || err.message);
      setSaving(false);
    }
  };

  return (
    <form className="sabi-cat-form sabi-record-form" onSubmit={submit}>
      <label>
        Title
        <input type="text" value={fields.title} onChange={set("title")} placeholder="e.g. Malaria test result" maxLength={160} autoFocus required />
      </label>
      <div className="sabi-record-form-row">
        <label>
          Type
          <select value={fields.recordType} onChange={set("recordType")}>
            {RECORD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input type="date" value={fields.date} onChange={set("date")} max={today()} required />
        </label>
      </div>
      <div className="sabi-record-form-row">
        <label>
          Hospital / facility (optional)
          <input type="text" value={fields.facility} onChange={set("facility")} maxLength={160} />
        </label>
        <label>
          Doctor (optional)
          <input type="text" value={fields.doctorName} onChange={set("doctorName")} maxLength={120} />
        </label>
      </div>
      <label>
        Diagnosis (optional)
        <textarea value={fields.diagnosis} onChange={set("diagnosis")} rows={2} maxLength={500} />
      </label>
      <label>
        Treatment (optional)
        <textarea value={fields.treatment} onChange={set("treatment")} rows={2} maxLength={500} />
      </label>
      <label>
        Notes (optional)
        <textarea value={fields.notes} onChange={set("notes")} rows={2} maxLength={2000} />
      </label>
      {!fixedCategoryId && categories.length > 0 && (
        <label>
          Folder (optional)
          <select value={fields.categoryId} onChange={set("categoryId")}>
            <option value="">Leave unfiled</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      )}
      {error && <p className="sabi-form-error" role="alert">{error}</p>}
      <div className="sabi-modal-actions">
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function RecordFormModal({ categories, onClose, onSave }) {
  return (
    <Modal title="Add a record" onClose={onClose} wide>
      <RecordForm categories={categories} onSave={onSave} onCancel={onClose} />
    </Modal>
  );
}

export default RecordForm;

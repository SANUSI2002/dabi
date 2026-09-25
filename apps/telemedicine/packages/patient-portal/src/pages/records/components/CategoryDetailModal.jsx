import React, { useState } from "react";
import { Button } from "design-system";
import { X, Plus, Trash2 } from "lucide-react";
import { Modal } from "./Modal";
import { ConfirmModal } from "./ConfirmModal";
import { RecordViewModal } from "./RecordViewModal";
import { RecordForm } from "./RecordForm";

export function CategoryDetailModal({ category, allRecords, onClose, onAssign, onUnassign, onCreate, onDeleteCategory }) {
  const [showForm, setShowForm] = useState(false);
  const [pickedId, setPickedId] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [viewingRecord, setViewingRecord] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { kind, payload }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const filed = allRecords.filter((r) => r.categoryId === category.id);
  const unfiled = allRecords.filter((r) => !r.categoryId);

  const toggleSelected = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const allSelected = filed.length > 0 && selectedIds.length === filed.length;
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : filed.map((r) => r.id));

  const requestAssign = () => pickedId && setConfirmAction({ kind: "assign", payload: pickedId });
  const requestRemove = (recordId) => setConfirmAction({ kind: "remove", payload: [recordId] });
  const requestBulkRemove = () => selectedIds.length && setConfirmAction({ kind: "remove", payload: selectedIds });
  const requestDeleteCategory = () => setConfirmAction({ kind: "delete-category" });

  const runConfirmed = async () => {
    const action = confirmAction;
    if (!action) return;
    setConfirmAction(null);
    setBusy(true);
    setError(null);
    try {
      if (action.kind === "assign") {
        await onAssign(action.payload);
        setPickedId("");
      } else if (action.kind === "remove") {
        for (const id of action.payload) await onUnassign(id);
        setSelectedIds((prev) => prev.filter((id) => !action.payload.includes(id)));
      } else if (action.kind === "delete-category") {
        await onDeleteCategory(category.id);
        onClose();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmCopy = {
    assign: {
      title: "File in this folder?",
      message: `File "${unfiled.find((r) => r.id === confirmAction?.payload)?.title}" under ${category.name}?`,
      confirmLabel: "File Record",
    },
    remove: {
      title: confirmAction?.payload?.length > 1 ? "Take records out of this folder?" : "Take record out of this folder?",
      message: `This takes ${confirmAction?.payload?.length > 1 ? `${confirmAction.payload.length} records` : "this record"} out of ${category.name} only — the record itself is kept and can be filed again anytime.`,
      confirmLabel: "Take Out",
    },
    "delete-category": {
      title: "Delete this folder?",
      message: `${category.name} is empty, so it's safe to delete. None of your records are affected.`,
      confirmLabel: "Delete Folder",
    },
  }[confirmAction?.kind];

  return (
    <Modal title={category.name} onClose={onClose} wide={showForm}>
      {filed.length > 0 ? (
        <>
          <div className="sabi-cat-bulk-row">
            <label className="sabi-cat-select-all">
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
              Select all
            </label>
            {selectedIds.length > 0 && (
              <button type="button" className="sabi-cat-bulk-remove" onClick={requestBulkRemove} disabled={busy}>
                <Trash2 size={13} /> Take {selectedIds.length} out of folder
              </button>
            )}
          </div>

          <ul className="sabi-cat-record-list">
            {filed.map((r) => (
              <li key={r.id} className="sabi-cat-record-row">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(r.id)}
                  onChange={() => toggleSelected(r.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Select ${r.title}`}
                />
                <button type="button" className="sabi-cat-record-view-btn" onClick={() => setViewingRecord(r)}>
                  <div className="sabi-cat-record-title">{r.title}</div>
                  <div className="sabi-cat-record-notes">{r.meta}</div>
                </button>
                <div className="sabi-cat-record-right">
                  <span className="sabi-cat-record-date">{r.date}</span>
                  <button
                    type="button"
                    className="sabi-cat-record-remove"
                    onClick={() => requestRemove(r.id)}
                    disabled={busy}
                    aria-label={`Take ${r.title} out of ${category.name}`}
                    title="Take out of this folder"
                  >
                    <X size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="sabi-modal-empty">No records filed in this folder yet.</p>
      )}

      {error && <p className="sabi-form-error" role="alert">{error}</p>}

      {unfiled.length > 0 && !showForm && (
        <div className="sabi-cat-assign">
          <label>
            File an existing record in {category.name}
            <div className="sabi-cat-assign-row">
              <select value={pickedId} onChange={(e) => setPickedId(e.target.value)}>
                <option value="">Choose an unfiled record…</option>
                {unfiled.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} — {r.date}
                  </option>
                ))}
              </select>
              <Button type="button" variant="secondary" onClick={requestAssign} disabled={!pickedId || busy}>
                File
              </Button>
            </div>
          </label>
        </div>
      )}

      {showForm ? (
        <RecordForm
          fixedCategoryId={category.id}
          submitLabel={`Save to ${category.name}`}
          onCancel={() => setShowForm(false)}
          onSave={async (fields) => {
            await onCreate(fields);
            setShowForm(false);
          }}
        />
      ) : (
        <div className="sabi-modal-actions">
          <Button type="button" variant="primary" onClick={() => setShowForm(true)}>
            <Plus size={15} style={{ verticalAlign: "-2px", marginRight: 4 }} />
            New Record in {category.name}
          </Button>
        </div>
      )}

      {!showForm && (
        <div className="sabi-cat-delete-row">
          {filed.length === 0 ? (
            <button type="button" className="sabi-cat-delete-category-btn" onClick={requestDeleteCategory} disabled={busy}>
              <Trash2 size={14} /> Delete this folder
            </button>
          ) : (
            <p className="sabi-cat-delete-hint">Take every record out of this folder before deleting it.</p>
          )}
        </div>
      )}

      {viewingRecord && <RecordViewModal record={viewingRecord} onClose={() => setViewingRecord(null)} />}

      {confirmAction && (
        <ConfirmModal
          title={confirmCopy.title}
          message={confirmCopy.message}
          confirmLabel={confirmCopy.confirmLabel}
          onConfirm={runConfirmed}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </Modal>
  );
}

export default CategoryDetailModal;

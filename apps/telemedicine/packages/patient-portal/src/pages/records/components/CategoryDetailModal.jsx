import React, { useState } from "react";
import { Button } from "design-system";
import { X, Plus, Trash2 } from "lucide-react";
import { Modal } from "./Modal";
import { ConfirmModal } from "./ConfirmModal";
import { RecordViewModal } from "./RecordViewModal";

export function CategoryDetailModal({ category, allRecords, onClose, onAssign, onUnassign, onCreate, onDeleteCategory }) {
  const [showForm, setShowForm] = useState(false);
  const [pickedId, setPickedId] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [viewingRecord, setViewingRecord] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { kind, payload }

  const filed = allRecords.filter((r) => r.categoryId === category.id);
  const unfiled = allRecords.filter((r) => !r.categoryId);

  const toggleSelected = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const allSelected = filed.length > 0 && selectedIds.length === filed.length;
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : filed.map((r) => r.id));

  const submitNew = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setConfirmAction({ kind: "create", payload: { title: title.trim(), date: date || "Undated", notes: notes.trim() } });
  };

  const requestAssign = () => {
    if (!pickedId) return;
    setConfirmAction({ kind: "assign", payload: pickedId });
  };

  const requestRemove = (recordId) => setConfirmAction({ kind: "remove", payload: [recordId] });
  const requestBulkRemove = () => selectedIds.length && setConfirmAction({ kind: "remove", payload: selectedIds });
  const requestDeleteCategory = () => setConfirmAction({ kind: "delete-category" });

  const runConfirmed = () => {
    if (!confirmAction) return;
    if (confirmAction.kind === "create") {
      onCreate(confirmAction.payload);
      setTitle("");
      setDate("");
      setNotes("");
      setShowForm(false);
    } else if (confirmAction.kind === "assign") {
      onAssign(confirmAction.payload);
      setPickedId("");
    } else if (confirmAction.kind === "remove") {
      confirmAction.payload.forEach((id) => onUnassign(id));
      setSelectedIds((prev) => prev.filter((id) => !confirmAction.payload.includes(id)));
    } else if (confirmAction.kind === "delete-category") {
      onDeleteCategory(category.id);
      onClose();
    }
    setConfirmAction(null);
  };

  const confirmCopy = {
    create: { title: "Add this record?", message: `Add "${confirmAction?.payload?.title}" to ${category.label}?`, confirmLabel: "Add Record" },
    assign: {
      title: "Add to category?",
      message: `Add "${unfiled.find((r) => r.id === confirmAction?.payload)?.title}" to ${category.label}?`,
      confirmLabel: "Add",
    },
    remove: {
      title: confirmAction?.payload?.length > 1 ? "Remove records from category?" : "Remove record from category?",
      message: `This removes ${confirmAction?.payload?.length > 1 ? `${confirmAction.payload.length} records` : "this record"} from ${category.label} only — the record itself isn't deleted and can be re-added or filed under another category anytime.`,
      confirmLabel: "Remove",
    },
    "delete-category": {
      title: "Delete this category?",
      message: `${category.label} is empty, so it's safe to delete. This only removes the category folder — none of your records are affected.`,
      confirmLabel: "Delete Category",
    },
  }[confirmAction?.kind];

  return (
    <Modal title={category.label} onClose={onClose}>
      {filed.length > 0 ? (
        <>
          <div className="sabi-cat-bulk-row">
            <label className="sabi-cat-select-all">
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
              Select all
            </label>
            {selectedIds.length > 0 && (
              <button type="button" className="sabi-cat-bulk-remove" onClick={requestBulkRemove}>
                <Trash2 size={13} /> Remove {selectedIds.length} from category
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
                />
                <button type="button" className="sabi-cat-record-view-btn" onClick={() => setViewingRecord(r)}>
                  <div className="sabi-cat-record-title">{r.title}</div>
                  {(r.notes || r.meta) && <div className="sabi-cat-record-notes">{r.notes || r.meta}</div>}
                </button>
                <div className="sabi-cat-record-right">
                  <span className="sabi-cat-record-date">{r.date}</span>
                  <button
                    type="button"
                    className="sabi-cat-record-remove"
                    onClick={() => requestRemove(r.id)}
                    aria-label={`Remove ${r.title} from ${category.label}`}
                    title="Remove from this category"
                  >
                    <X size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="sabi-cat-note">Removing a record here only takes it out of this category — records themselves can't be deleted.</p>
        </>
      ) : (
        <p className="sabi-modal-empty">No records filed under this category yet.</p>
      )}

      {unfiled.length > 0 && (
        <div className="sabi-cat-assign">
          <label>
            Add an existing record to {category.label}
            <div className="sabi-cat-assign-row">
              <select value={pickedId} onChange={(e) => setPickedId(e.target.value)}>
                <option value="">Choose a record without a category…</option>
                {unfiled.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} — {r.date}
                  </option>
                ))}
              </select>
              <Button type="button" variant="secondary" onClick={requestAssign} disabled={!pickedId}>
                Add
              </Button>
            </div>
          </label>
        </div>
      )}

      {showForm ? (
        <form className="sabi-cat-form" onSubmit={submitNew}>
          <label>
            New record title
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Malaria Test Result"
              autoFocus
              required
            />
          </label>
          <label>
            Date
            <input type="text" value={date} onChange={(e) => setDate(e.target.value)} placeholder="e.g. Jul 17, 2026" />
          </label>
          <label>
            Notes (optional)
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </label>
          <div className="sabi-modal-actions">
            <Button type="submit" variant="primary">
              Save Record
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="sabi-modal-actions">
          <Button type="button" variant="primary" onClick={() => setShowForm(true)}>
            <Plus size={15} style={{ verticalAlign: "-2px", marginRight: 4 }} />
            New Record in {category.label}
          </Button>
        </div>
      )}

      <div className="sabi-cat-delete-row">
        {filed.length === 0 ? (
          <button type="button" className="sabi-cat-delete-category-btn" onClick={requestDeleteCategory}>
            <Trash2 size={14} /> Delete this category
          </button>
        ) : (
          <p className="sabi-cat-delete-hint">Remove all records from this category before you can delete it.</p>
        )}
      </div>

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

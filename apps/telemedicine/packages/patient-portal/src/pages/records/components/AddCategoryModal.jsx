import React, { useState } from "react";
import { Button } from "design-system";
import { Modal } from "./Modal";
import { CATEGORY_ICON_CHOICES, categoryIcon } from "../data";

export function AddCategoryModal({ onClose, onCreate }) {
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState(CATEGORY_ICON_CHOICES[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onCreate({ label: label.trim(), icon });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Modal title="Add Folder" onClose={onClose}>
      <form className="sabi-cat-form" onSubmit={submit}>
        <label>
          Folder name
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Dental Records"
            maxLength={80}
            autoFocus
            required
          />
        </label>

        <div className="sabi-icon-picker-label">Icon</div>
        <div className="sabi-icon-picker">
          {CATEGORY_ICON_CHOICES.map((name) => {
            const ChoiceIcon = categoryIcon(name);
            return (
              <button
                key={name}
                type="button"
                className={"sabi-icon-choice" + (name === icon ? " selected" : "")}
                onClick={() => setIcon(name)}
                aria-pressed={name === icon}
                aria-label={`Use the ${name} icon`}
              >
                <ChoiceIcon size={17} />
              </button>
            );
          })}
        </div>

        {error && <p className="sabi-form-error" role="alert">{error}</p>}
        <div className="sabi-modal-actions">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Creating…" : "Create Folder"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default AddCategoryModal;

import React, { useState } from "react";
import { Button } from "design-system";
import { Modal } from "./Modal";
import { CATEGORY_ICON_CHOICES } from "../data";

export function AddCategoryModal({ onClose, onCreate }) {
  const [label, setLabel] = useState("");
  const [iconIndex, setIconIndex] = useState(0);
  const Icon = CATEGORY_ICON_CHOICES[iconIndex];

  const submit = (e) => {
    e.preventDefault();
    if (!label.trim()) return;
    onCreate({ label: label.trim(), icon: CATEGORY_ICON_CHOICES[iconIndex] });
  };

  return (
    <Modal title="Add Category" onClose={onClose}>
      <form className="sabi-cat-form" onSubmit={submit}>
        <label>
          Category name
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Dental Records"
            autoFocus
            required
          />
        </label>

        <div className="sabi-icon-picker-label">Icon</div>
        <div className="sabi-icon-picker">
          {CATEGORY_ICON_CHOICES.map((ChoiceIcon, i) => (
            <button
              key={i}
              type="button"
              className={"sabi-icon-choice" + (i === iconIndex ? " selected" : "")}
              onClick={() => setIconIndex(i)}
              aria-pressed={i === iconIndex}
              aria-label={`Use this icon`}
            >
              <ChoiceIcon size={17} />
            </button>
          ))}
        </div>

        <div className="sabi-modal-actions">
          <Button type="submit" variant="primary">
            Create Category
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default AddCategoryModal;

import React from "react";

export function ToggleSwitch({ checked, defaultChecked, label, onChange }) {
  return (
    <label className="sabi-toggle" aria-label={label}>
      <input
        type="checkbox"
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange}
      />
      <span className="sabi-toggle-track">
        <span className="sabi-toggle-thumb" />
      </span>
    </label>
  );
}

export default ToggleSwitch;

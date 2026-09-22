import React from "react";

export function SelectField({ label, defaultValue, options }) {
  return (
    <div className="sabi-field">
      <label className="sabi-field-label">{label}</label>
      <div className="sabi-field-select-wrap">
        <select className="sabi-field-select" defaultValue={defaultValue}>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default SelectField;

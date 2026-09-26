import React from "react";

export function SelectField({ label, defaultValue, value, onChange, options }) {
  const bound = value !== undefined ? { value, onChange: (e) => onChange?.(e.target.value) } : { defaultValue };
  return (
    <div className="sabi-field">
      <label className="sabi-field-label">{label}</label>
      <div className="sabi-field-select-wrap">
        <select className="sabi-field-select" {...bound}>
          {value === "" && <option value="">Select</option>}
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

import React, { useId } from "react";

/** `options` are strings; `emptyLabel` adds a "no value" choice (value ""). */
export function SelectField({ label, value, onChange, options, emptyLabel }) {
  const id = useId();
  // Keep a stored value selectable even if it isn't one of today's options.
  const all = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <div className="sabi-field">
      <label htmlFor={id} className="sabi-field-label">{label}</label>
      <div className="sabi-field-select-wrap">
        <select id={id} className="sabi-field-select" value={value} onChange={(e) => onChange(e.target.value)}>
          {emptyLabel && <option value="">{emptyLabel}</option>}
          {all.map((o) => (
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

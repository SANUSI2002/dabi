import React from "react";

export function TextField({ label, defaultValue, value, onChange, readOnly, placeholder, type = "text", uppercaseLabel }) {
  const bound = value !== undefined ? { value, onChange: (e) => onChange?.(e.target.value) } : { defaultValue };
  return (
    <div className="sabi-field">
      <label className={`sabi-field-label${uppercaseLabel ? " uppercase" : ""}`}>{label}</label>
      <input className="sabi-field-input" type={type} {...bound} readOnly={readOnly} placeholder={placeholder} />
    </div>
  );
}

export default TextField;

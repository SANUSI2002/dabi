import React from "react";

export function TextArea({ label, defaultValue, value, onChange, placeholder }) {
  const bound = value !== undefined ? { value, onChange: (e) => onChange?.(e.target.value) } : { defaultValue };
  return (
    <div className="sabi-field">
      <label className="sabi-field-label">{label}</label>
      <textarea className="sabi-field-textarea" {...bound} placeholder={placeholder} rows={3} />
    </div>
  );
}

export default TextArea;

import React from "react";

export function TextArea({ label, defaultValue, placeholder }) {
  return (
    <div className="sabi-field">
      <label className="sabi-field-label">{label}</label>
      <textarea className="sabi-field-textarea" defaultValue={defaultValue} placeholder={placeholder} rows={3} />
    </div>
  );
}

export default TextArea;

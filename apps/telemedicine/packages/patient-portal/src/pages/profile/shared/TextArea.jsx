import React, { useId } from "react";

export function TextArea({ label, value, onChange, placeholder, maxLength = 1000, error }) {
  const id = useId();
  return (
    <div className="sabi-field">
      <label htmlFor={id} className="sabi-field-label">{label}</label>
      <textarea
        id={id}
        className={`sabi-field-textarea${error ? " invalid" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={3}
      />
      {error && <span className="sabi-field-error">{error}</span>}
    </div>
  );
}

export default TextArea;

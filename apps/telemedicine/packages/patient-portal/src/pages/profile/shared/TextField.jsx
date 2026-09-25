import React, { useId } from "react";

export function TextField({ label, value, onChange, placeholder, type = "text", uppercaseLabel, error, readOnly, hint, ...rest }) {
  const id = useId();
  return (
    <div className="sabi-field">
      <label htmlFor={id} className={`sabi-field-label${uppercaseLabel ? " uppercase" : ""}`}>{label}</label>
      <input
        id={id}
        className={`sabi-field-input${error ? " invalid" : ""}`}
        type={type}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        readOnly={readOnly}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-note` : undefined}
        {...rest}
      />
      {(error || hint) && <span id={`${id}-note`} className={error ? "sabi-field-error" : "sabi-field-hint"}>{error || hint}</span>}
    </div>
  );
}

export default TextField;

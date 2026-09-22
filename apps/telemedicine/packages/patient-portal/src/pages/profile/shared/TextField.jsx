import React from "react";

export function TextField({ label, defaultValue, placeholder, type = "text", uppercaseLabel }) {
  return (
    <div className="sabi-field">
      <label className={`sabi-field-label${uppercaseLabel ? " uppercase" : ""}`}>{label}</label>
      <input className="sabi-field-input" type={type} defaultValue={defaultValue} placeholder={placeholder} />
    </div>
  );
}

export default TextField;

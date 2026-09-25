import React from "react";

export function ConsentCheckbox({ title, description, checked, onChange }) {
  return (
    <label className="sabi-consent-row">
      <span className="sabi-consent-box">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="sabi-consent-check">✓</span>
      </span>
      <span>
        <span className="sabi-consent-title">{title}</span>
        <span className="sabi-consent-desc">{description}</span>
      </span>
    </label>
  );
}

export default ConsentCheckbox;

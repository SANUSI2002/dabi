import React from "react";

export function ConsentCheckbox({ title, description, defaultChecked, checked, onChange }) {
  const bound = checked !== undefined ? { checked, onChange: (e) => onChange?.(e.target.checked) } : { defaultChecked };
  return (
    <label className="sabi-consent-row">
      <span className="sabi-consent-box">
        <input type="checkbox" {...bound} />
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

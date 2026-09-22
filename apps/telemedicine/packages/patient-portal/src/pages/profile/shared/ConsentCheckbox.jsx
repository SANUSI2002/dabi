import React from "react";

export function ConsentCheckbox({ title, description, defaultChecked }) {
  return (
    <label className="sabi-consent-row">
      <span className="sabi-consent-box">
        <input type="checkbox" defaultChecked={defaultChecked} />
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

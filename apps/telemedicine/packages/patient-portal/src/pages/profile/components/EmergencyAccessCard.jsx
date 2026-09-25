import React from "react";
import { SectionCard } from "../shared";
import { EMERGENCY_ACCESS_OPTIONS } from "../../../api/profileApi";

/* Verified hospitals only receive the record categories the patient has saved here. */
export function EmergencyAccessCard({ form, set }) {
  const toggle = (value) => {
    const current = form.emergencyAccess;
    set("emergencyAccess", current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
  };

  return (
    <SectionCard icon="🚨" title="Emergency Access">
      <p className="sabi-emergency-access-intro">Choose which records verified hospitals can access when you need emergency care.</p>
      <div className="sabi-consent-list">
        {EMERGENCY_ACCESS_OPTIONS.map((record) => (
          <label className="sabi-consent-row" key={record.value}>
            <span className="sabi-consent-box">
              <input type="checkbox" checked={form.emergencyAccess.includes(record.value)} onChange={() => toggle(record.value)} />
              <span className="sabi-consent-check">✓</span>
            </span>
            <span>
              <span className="sabi-consent-title">{record.label || record.value}</span>
              <span className="sabi-consent-desc">{record.description}</span>
            </span>
          </label>
        ))}
      </div>
    </SectionCard>
  );
}

export default EmergencyAccessCard;

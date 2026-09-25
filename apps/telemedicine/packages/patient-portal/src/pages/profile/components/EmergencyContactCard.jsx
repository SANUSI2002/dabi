import React from "react";
import { SectionCard, TextField } from "../shared";

export function EmergencyContactCard({ form, set, errors }) {
  return (
    <SectionCard icon="📞" title="Emergency Contact">
      <p className="sabi-emergency-access-intro">Shown on your Emergency ID and emergency PDF. Clear all three fields to remove it.</p>
      <div className="sabi-field-grid">
        <TextField label="Name" value={form.contactName} onChange={(v) => set("contactName", v)} error={errors.contactName} maxLength={120} />
        <TextField label="Phone Number" value={form.contactPhone} onChange={(v) => set("contactPhone", v)} type="tel" error={errors.contactPhone} maxLength={30} />
        <TextField label="Relationship" value={form.contactRelation} onChange={(v) => set("contactRelation", v)} placeholder="E.g. Sister" error={errors.contactRelation} maxLength={80} />
      </div>
    </SectionCard>
  );
}

export default EmergencyContactCard;

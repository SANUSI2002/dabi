import React from "react";
import { SectionCard, SelectField, TextField } from "../shared";
import { SMOKING_OPTIONS, ALCOHOL_OPTIONS } from "../data";

export function LifestyleInformationCard({ form, set }) {
  return (
    <SectionCard icon="🏃" title="Lifestyle Information">
      <div className="sabi-field-grid">
        <SelectField label="Smoking Status" value={form.smokingStatus} onChange={(v) => set("smokingStatus", v)} options={SMOKING_OPTIONS} />
        <SelectField label="Alcohol Frequency" value={form.alcoholFrequency} onChange={(v) => set("alcoholFrequency", v)} options={ALCOHOL_OPTIONS} />
      </div>
      <TextField
        label="Physical Activity"
        value={form.physicalActivity}
        onChange={(v) => set("physicalActivity", v)}
        placeholder="E.g. Running 3x weekly"
      />
    </SectionCard>
  );
}

export default LifestyleInformationCard;

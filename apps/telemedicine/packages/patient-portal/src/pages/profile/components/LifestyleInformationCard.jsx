import React from "react";
import { SectionCard, SelectField, TextField } from "../shared";
import { ALCOHOL_OPTIONS, SMOKING_OPTIONS } from "../../../api/profileApi";

export function LifestyleInformationCard({ form, set }) {
  return (
    <SectionCard icon="🏃" title="Lifestyle Information">
      <div className="sabi-field-grid">
        <SelectField label="Smoking Status" value={form.smokingStatus} onChange={(v) => set("smokingStatus", v)} options={SMOKING_OPTIONS} emptyLabel="Not specified" />
        <SelectField label="Alcohol Frequency" value={form.alcoholFrequency} onChange={(v) => set("alcoholFrequency", v)} options={ALCOHOL_OPTIONS} emptyLabel="Not specified" />
      </div>
      <TextField
        label="Physical Activity"
        value={form.physicalActivity}
        onChange={(v) => set("physicalActivity", v)}
        placeholder="E.g. Running 3x weekly"
        maxLength={200}
      />
    </SectionCard>
  );
}

export default LifestyleInformationCard;

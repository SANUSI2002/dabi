import React from "react";
import { SectionCard, SelectField, TextField } from "../shared";
import { LIFESTYLE, SMOKING_OPTIONS, ALCOHOL_OPTIONS } from "../data";

export function LifestyleInformationCard() {
  return (
    <SectionCard icon="🏃" title="Lifestyle Information">
      <div className="sabi-field-grid">
        <SelectField label="Smoking Status" defaultValue={LIFESTYLE.smokingStatus} options={SMOKING_OPTIONS} />
        <SelectField label="Alcohol Frequency" defaultValue={LIFESTYLE.alcoholFrequency} options={ALCOHOL_OPTIONS} />
      </div>
      <TextField
        label="Physical Activity"
        defaultValue={LIFESTYLE.physicalActivity}
        placeholder="E.g. Running 3x weekly"
      />
    </SectionCard>
  );
}

export default LifestyleInformationCard;

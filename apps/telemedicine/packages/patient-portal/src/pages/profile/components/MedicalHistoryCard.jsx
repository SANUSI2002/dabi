import React from "react";
import { SectionCard, SelectField, TextField, TextArea } from "../shared";
import { MEDICAL_HISTORY, BLOOD_TYPE_OPTIONS } from "../data";

export function MedicalHistoryCard() {
  return (
    <SectionCard icon="📋" title="Medical History">
      <div className="sabi-field-grid">
        <SelectField label="Blood Type" defaultValue={MEDICAL_HISTORY.bloodType} options={BLOOD_TYPE_OPTIONS} />
        <TextField label="Genotype" defaultValue={MEDICAL_HISTORY.genotype} />
      </div>
      <TextArea
        label="Chronic Conditions"
        defaultValue={MEDICAL_HISTORY.chronicConditions}
        placeholder="E.g. Hypertension, Asthma..."
      />
    </SectionCard>
  );
}

export default MedicalHistoryCard;

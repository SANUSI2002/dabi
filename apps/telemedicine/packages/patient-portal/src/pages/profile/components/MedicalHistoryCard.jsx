import React from "react";
import { SectionCard, SelectField, TextField, TextArea } from "../shared";
import { BLOOD_TYPE_OPTIONS } from "../data";

export function MedicalHistoryCard({ form, set }) {
  return (
    <SectionCard icon="📋" title="Medical History">
      <div className="sabi-field-grid">
        <SelectField label="Blood Type" value={form.bloodType} onChange={(v) => set("bloodType", v)} options={BLOOD_TYPE_OPTIONS} />
        <TextField label="Genotype" value={form.genotype} onChange={(v) => set("genotype", v.toUpperCase())} />
      </div>
      <TextArea
        label="Chronic Conditions"
        value={form.chronicConditions}
        onChange={(v) => set("chronicConditions", v)}
        placeholder="E.g. Hypertension, Asthma..."
      />
    </SectionCard>
  );
}

export default MedicalHistoryCard;

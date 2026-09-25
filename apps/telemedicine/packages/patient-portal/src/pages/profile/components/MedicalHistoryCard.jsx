import React from "react";
import { SectionCard, SelectField, TextArea } from "../shared";
import { BLOOD_TYPES, GENOTYPES } from "../../../api/profileApi";

export function MedicalHistoryCard({ form, set }) {
  return (
    <SectionCard icon="📋" title="Medical History">
      <div className="sabi-field-grid">
        <SelectField label="Blood Type" value={form.bloodType} onChange={(v) => set("bloodType", v)} options={BLOOD_TYPES} emptyLabel="Not recorded" />
        <SelectField label="Genotype" value={form.genotype} onChange={(v) => set("genotype", v)} options={GENOTYPES} emptyLabel="Not recorded" />
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

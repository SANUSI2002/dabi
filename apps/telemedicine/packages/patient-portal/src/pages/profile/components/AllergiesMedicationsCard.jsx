import React from "react";
import { SectionCard, TextArea } from "../shared";
export function AllergiesMedicationsCard({ form, set }) {
  return (
    <SectionCard icon="💊" title="Allergies & Medications">
      <TextArea
        label="Known Allergies"
        value={form.knownAllergies}
        onChange={(v) => set("knownAllergies", v)}
        placeholder="E.g. Penicillin, Peanuts..."
      />
      <TextArea
        label="Current Medications"
        value={form.currentMedications}
        onChange={(v) => set("currentMedications", v)}
        placeholder="E.g. Lisinopril 10mg once daily..."
      />
    </SectionCard>
  );
}

export default AllergiesMedicationsCard;

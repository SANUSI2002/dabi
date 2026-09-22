import React from "react";
import { SectionCard, TextArea } from "../shared";
import { ALLERGIES_MEDICATIONS } from "../data";

export function AllergiesMedicationsCard() {
  return (
    <SectionCard icon="💊" title="Allergies & Medications">
      <TextArea
        label="Known Allergies"
        defaultValue={ALLERGIES_MEDICATIONS.knownAllergies}
        placeholder="E.g. Penicillin, Peanuts..."
      />
      <TextArea
        label="Current Medications"
        defaultValue={ALLERGIES_MEDICATIONS.currentMedications}
        placeholder="E.g. Lisinopril 10mg once daily..."
      />
    </SectionCard>
  );
}

export default AllergiesMedicationsCard;

import React from "react";
import { SectionCard, ConsentCheckbox } from "../shared";

const CONSENTS = [
  { key: "dataSharing", title: "Data Sharing Consent", description: "Allow sharing anonymized data for research purposes." },
  { key: "electronicRecords", title: "Electronic Health Records", description: "Agreement to use digital health records for all consultations." },
];

export function ConsentPrivacyCard({ form, set }) {
  return (
    <SectionCard icon="🔏" title="Consent & Privacy">
      <div className="sabi-consent-list">
        {CONSENTS.map((c) => (
          <ConsentCheckbox key={c.key} title={c.title} description={c.description} checked={Boolean(form[c.key])} onChange={(v) => set(c.key, v)} />
        ))}
      </div>
      <p className="sabi-field-hint">Each change is recorded with the date you made it.</p>
    </SectionCard>
  );
}

export default ConsentPrivacyCard;

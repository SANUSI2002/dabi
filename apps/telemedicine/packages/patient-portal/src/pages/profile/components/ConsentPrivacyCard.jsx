import React from "react";
import { SectionCard, ConsentCheckbox } from "../shared";
import { CONSENTS } from "../data";

export function ConsentPrivacyCard({ form, set }) {
  return (
    <SectionCard icon="🔏" title="Consent & Privacy">
      <div className="sabi-consent-list">
        {CONSENTS.map((c) => (
          <ConsentCheckbox key={c.key} title={c.title} description={c.description} checked={Boolean(form[c.field])} onChange={(v) => set(c.field, v)} />
        ))}
      </div>
      <button className="sabi-text-link" type="button">
        View Full Privacy Agreement
      </button>
    </SectionCard>
  );
}

export default ConsentPrivacyCard;

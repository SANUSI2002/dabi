import React from "react";
import { Card, Button } from "design-system";
import { SectionTitle } from "../share";
import { MEDICATIONS } from "../data";

export function MedicationsCard() {
  const remaining = MEDICATIONS.filter((m) => m.state === "take").length;

  return (
    <Card>
      <SectionTitle action={`${remaining} remaining`}>Medications</SectionTitle>

      {MEDICATIONS.map((m, i) =>
        m.state === "take" ? (
          <div className="sabi-med-featured" key={i}>
            <div className="sabi-med-featured-head">
              <div>
                <div className="sabi-med-name">{m.name}</div>
                <div className="sabi-med-sub">{m.sub}</div>
              </div>
              <div className="sabi-med-icon">💊</div>
            </div>
            <Button variant="primary" style={{ width: "100%" }}>
              Mark as Taken
            </Button>
          </div>
        ) : (
          <div className="sabi-med-item" key={i}>
            <div>
              <div className="sabi-med-name">{m.name}</div>
              <div className="sabi-med-sub">{m.sub}</div>
            </div>
            <span className="sabi-med-taken-icon" aria-label="Taken">✓</span>
          </div>
        )
      )}
    </Card>
  );
}

export default MedicationsCard;

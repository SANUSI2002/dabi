import React, { useState } from "react";
import { Card, Button } from "design-system";
import { Pill, CheckCircle2 } from "lucide-react";
import { SectionTitle } from "../share";
import { MEDICATIONS } from "../data";


export function MedicationsCard() {
  const [meds, setMeds] = useState(MEDICATIONS);
  const remaining = meds.filter((m) => m.state === "take").length;

  const markTaken = (i) => {
    setMeds((prev) =>
      prev.map((m, idx) =>
        idx === i ? { ...m, state: "taken", sub: "08:00 AM · Taken" } : m
      )
    );
  };

  return (
    <Card className="sabi-med-card">
      {/* Header */}
      <SectionTitle action={`${remaining} remaining`}>
        Medications
      </SectionTitle>

      {/* List */}
      <div className="sabi-med-list">
        {meds.map((m, i) =>
          m.state === "take" ? (
            <div className="sabi-med-featured" key={i}>
              <div className="sabi-med-featured-head">
                <div>
                  <div className="sabi-med-name">{m.name}</div>
                  <div className="sabi-med-sub">{m.sub}</div>
                </div>
                <div className="sabi-med-icon">
                  <Pill size={15} />
                </div>
              </div>
              <Button
                variant="primary"
                className="sabi-med-btn"
                onClick={() => markTaken(i)}
              >
                Mark as Taken
              </Button>
            </div>
          ) : (
            <div className="sabi-med-item" key={i}>
              <div>
                <div className="sabi-med-name">{m.name}</div>
                <div className="sabi-med-sub">{m.sub}</div>
              </div>
              <span className="sabi-med-taken-icon" aria-label="Taken">
                <CheckCircle2 size={18} />
              </span>
            </div>
          )
        )}
      </div>
    </Card>
  );
}

export default MedicationsCard;
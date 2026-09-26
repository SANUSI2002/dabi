import React from "react";
import { Card } from "design-system";
import { SectionTitle, MiniBars, MiniWave } from "../share";

function VitalStat({ label, value, unit, status, children }) {
  return (
    <div className="sabi-vital">
      <div className="sabi-vital-label">{label}</div>
      <div className="sabi-vital-value">
        {value} <small>{unit}</small>
      </div>
      <div className="sabi-vital-status">{status}</div>
      {children}
    </div>
  );
}

export function VitalHistory() {
  return (
    <Card>
      <SectionTitle action="History">Vital History</SectionTitle>
      <div className="sabi-vitals-grid">
        <VitalStat label="Blood Pressure" value="118/72" unit="mmHg" status="↓ Optimal Range">
          <MiniBars />
        </VitalStat>
        <VitalStat label="Heart Rate" value="74" unit="BPM" status="⊙ Steady">
          <MiniWave />
        </VitalStat>
      </div>
    </Card>
  );
}

export default VitalHistory;

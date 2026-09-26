import React from "react";
import { Card } from "design-system";
import { SectionTitle, MiniBars, MiniWave } from "../share";
import { useApiData } from "../../../api/useApiData";
import { fetchReadings } from "../../vitals/vitalsStore";

const shortDate = (iso) => new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short" });

// Latest blood pressure and heart rate readings.
async function loadLatest() {
  const [bp, hr] = await Promise.all([fetchReadings("blood-pressure"), fetchReadings("heart-rate")]);
  return { bp: bp[0] || null, hr: hr[0] || null };
}

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
  const { data } = useApiData(loadLatest, []);
  const bp = data?.bp;
  const hr = data?.hr;
  return (
    <Card>
      <SectionTitle action="History">Vital History</SectionTitle>
      <div className="sabi-vitals-grid">
        <VitalStat label="Blood Pressure" value={bp ? `${bp.systolic}/${bp.diastolic}` : "—"} unit="mmHg" status={bp ? `Recorded ${shortDate(bp.recordedAt)}` : "No readings yet"}>
          <MiniBars />
        </VitalStat>
        <VitalStat label="Heart Rate" value={hr ? hr.value : "—"} unit="BPM" status={hr ? `Recorded ${shortDate(hr.recordedAt)}` : "No readings yet"}>
          <MiniWave />
        </VitalStat>
      </div>
    </Card>
  );
}

export default VitalHistory;

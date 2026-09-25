import React from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "design-system";
import { SectionTitle, MiniBars } from "../share";
import { useApiData } from "../../../api/useApiData";
import { fetchReadings } from "../../vitals/vitalsStore";

const shortDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

// Bar heights (px) for up to the last 7 readings, oldest on the left, scaled to the range.
function trendHeights(values) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return values.map((v) => (max === min ? 12 : Math.round(6 + ((v - min) / (max - min)) * 14)));
}

async function loadVitals() {
  const [bp, hr] = await Promise.all([fetchReadings("blood-pressure"), fetchReadings("heart-rate")]);
  return { bp: bp.slice(0, 7).reverse(), hr: hr.slice(0, 7).reverse() };
}

function VitalStat({ label, unit, readings, format, trendValue }) {
  const latest = readings[readings.length - 1];
  const heights = trendHeights(readings.map(trendValue));
  return (
    <div className="sabi-vital">
      <div className="sabi-vital-label">{label}</div>
      {latest ? (
        <>
          <div className="sabi-vital-value">
            {format(latest)} <small>{unit}</small>
          </div>
          <div className="sabi-vital-status">Recorded {shortDate(latest.recordedAt)}</div>
          {heights && <MiniBars heights={heights} />}
        </>
      ) : (
        <div className="sabi-vital-status">No readings yet</div>
      )}
    </div>
  );
}

export function VitalHistory() {
  const navigate = useNavigate();
  const { data, error } = useApiData(loadVitals, []);

  return (
    <Card>
      <SectionTitle action="History" onAction={() => navigate("/vitals")}>Vital History</SectionTitle>
      {error ? (
        <p className="sabi-dash-empty">{error.message}</p>
      ) : !data ? (
        <p className="sabi-dash-empty">Loading your latest readings…</p>
      ) : (
        <div className="sabi-vitals-grid">
          <VitalStat label="Blood Pressure" unit="mmHg" readings={data.bp} format={(r) => `${r.systolic}/${r.diastolic}`} trendValue={(r) => r.systolic} />
          <VitalStat label="Heart Rate" unit="BPM" readings={data.hr} format={(r) => r.value} trendValue={(r) => r.value} />
        </div>
      )}
      {data && !data.bp.length && !data.hr.length && (
        <button type="button" className="sabi-dash-link" onClick={() => navigate("/vitals/add")}>
          Record your first reading →
        </button>
      )}
    </Card>
  );
}

export default VitalHistory;

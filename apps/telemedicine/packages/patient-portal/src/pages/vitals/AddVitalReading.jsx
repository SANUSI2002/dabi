import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "design-system";
import { ArrowLeft, Info, Moon, TrendingUp, Zap, Lightbulb, Save } from "lucide-react";
import { Sidebar, Topbar } from "../dashboard/components";
import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { getVitalType } from "./data";
import { addReading } from "./vitalsStore";
import "../dashboard/Dashboard.css";
import "./Vitals.css";

const NOTE_CHIPS = [
  { label: "Resting", icon: Moon },
  { label: "Exercise", icon: TrendingUp },
  { label: "Stressed", icon: Zap },
];

function bpStatus(systolic, diastolic) {
  if (systolic < 120 && diastolic < 80) return { label: "Normal", note: "Optimal range", tone: "good" };
  if (systolic < 130 && diastolic < 80) return { label: "Elevated", note: "Monitor closely", tone: "warn" };
  if (systolic < 140 || diastolic < 90) return { label: "Stage 1 Hypertension", note: "Monitor closely", tone: "warn" };
  return { label: "Stage 2 Hypertension", note: "Consult your doctor", tone: "danger" };
}

export function AddVitalReading() {
  const { type: typeId } = useParams();
  const navigate = useNavigate();
  const [zoom] = useZoom();
  const type = getVitalType(typeId);

  const [systolic, setSystolic] = useState(120);
  const [diastolic, setDiastolic] = useState(80);
  const [value, setValue] = useState(type.default);
  const [activeChip, setActiveChip] = useState(null);
  const [notes, setNotes] = useState("");

  const status = type.kind === "bp" ? bpStatus(systolic, diastolic) : null;

  const save = (e) => {
    e.preventDefault();
    const now = new Date();
    const date = now.toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
    const time = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    const tags = activeChip ? [activeChip] : [];

    if (type.kind === "bp") {
      addReading(type.id, { date, time, systolic, diastolic, tags, source: "Manual", notes });
    } else {
      addReading(type.id, { date, time, value, tags, source: "Manual", notes });
    }
    navigate(`/vitals/history/${type.id}`);
  };

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar />

        <Link to="/vitals" className="sabi-vitals-crumb">
          <ArrowLeft size={14} /> Back to Vitals
        </Link>

        <div className="sabi-vitals-form-header">
          <h1>Add {type.label}</h1>
          <p>Record your {type.label.toLowerCase()} reading to keep your health journey on track.</p>
        </div>

        <form className="sabi-vitals-form-card" onSubmit={save}>
          {status && (
            <div className={"sabi-vitals-status sabi-vitals-status-" + status.tone}>
              <Info size={18} />
              <div>
                <div className="sabi-vitals-status-eyebrow">Health Status</div>
                <div className="sabi-vitals-status-label">{status.label}</div>
              </div>
              <span className="sabi-vitals-status-note">{status.note}</span>
            </div>
          )}

          {type.kind === "bp" ? (
            <>
              <div className="sabi-vitals-slider-block">
                <div className="sabi-vitals-slider-head">
                  <span>Systolic (mmHg)</span>
                  <span className="sabi-vitals-slider-value">{systolic}</span>
                </div>
                <input
                  type="range"
                  min={70}
                  max={220}
                  value={systolic}
                  onChange={(e) => setSystolic(Number(e.target.value))}
                  className="sabi-vitals-slider"
                />
                <div className="sabi-vitals-slider-scale"><span>70</span><span>120</span><span>220</span></div>
              </div>

              <div className="sabi-vitals-slider-block">
                <div className="sabi-vitals-slider-head">
                  <span>Diastolic (mmHg)</span>
                  <span className="sabi-vitals-slider-value">{diastolic}</span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={130}
                  value={diastolic}
                  onChange={(e) => setDiastolic(Number(e.target.value))}
                  className="sabi-vitals-slider"
                />
                <div className="sabi-vitals-slider-scale"><span>40</span><span>80</span><span>130</span></div>
              </div>
            </>
          ) : (
            <div className="sabi-vitals-slider-block">
              <div className="sabi-vitals-slider-head">
                <span>{type.label} ({type.unit})</span>
                <span className="sabi-vitals-slider-value">{value}</span>
              </div>
              <input
                type="range"
                min={type.min}
                max={type.max}
                step={type.step}
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                className="sabi-vitals-slider"
              />
              <div className="sabi-vitals-slider-scale"><span>{type.min}</span><span>{type.max}</span></div>
            </div>
          )}

          <div className="sabi-vitals-notes-label">Notes</div>
          <div className="sabi-vitals-chips">
            {NOTE_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                className={"sabi-vitals-chip" + (activeChip === chip.label ? " selected" : "")}
                onClick={() => setActiveChip(activeChip === chip.label ? null : chip.label)}
              >
                <chip.icon size={14} /> {chip.label}
              </button>
            ))}
          </div>
          <textarea
            className="sabi-vitals-textarea"
            rows={3}
            placeholder="Add any other details…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="sabi-vitals-tip">
            <Lightbulb size={18} />
            <p>
              <strong>Pro-tip:</strong> For the most accurate results, sit quietly for 5 minutes before taking your
              measurement. Avoid caffeine or exercise 30 mins prior.
            </p>
          </div>

          <div className="sabi-vitals-form-actions">
            <button type="button" className="sabi-apt-secondary-btn" onClick={() => navigate("/vitals")}>
              Cancel
            </button>
            <Button type="submit" variant="primary" className="sabi-apt-secondary-btn">
          
              Save Reading
            </Button>
          </div>
        </form>

        <p className="sabi-report-disclaimer" style={{ textAlign: "center", maxWidth: 560, margin: "var(--sabi-space-lg) auto" }}>
          Sabi Health uses clinical standards provided by the AHA. These indicators are for guidance only. Please
          consult a medical professional for official diagnosis.
        </p>
      </div>
    </div>
  );
}

export default AddVitalReading;

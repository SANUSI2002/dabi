import React, { useState } from "react";
import { useParams, useNavigate, Link, Navigate } from "react-router-dom";
import { Button } from "design-system";
import { ArrowLeft, Info, Lightbulb } from "lucide-react";
import { Sidebar, Topbar } from "../dashboard/components";
import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { getVitalType } from "./data";
import { saveReading } from "./vitalsStore";
import "../dashboard/Dashboard.css";
import "./Vitals.css";

// American Heart Association adult categories — guidance only, shown before saving.
function bpStatus(systolic, diastolic) {
  if (systolic < 120 && diastolic < 80) return { label: "Normal", note: "Optimal range", tone: "good" };
  if (systolic < 130 && diastolic < 80) return { label: "Elevated", note: "Monitor closely", tone: "warn" };
  if (systolic < 140 && diastolic < 90) return { label: "Stage 1 Hypertension", note: "Monitor closely", tone: "warn" };
  return { label: "Stage 2 Hypertension", note: "Consult your doctor", tone: "danger" };
}

export function AddVitalReading() {
  const { type: typeId } = useParams();
  const navigate = useNavigate();
  const [zoom] = useZoom();
  const type = getVitalType(typeId);

  const [systolic, setSystolic] = useState(120);
  const [diastolic, setDiastolic] = useState(80);
  const [value, setValue] = useState(type?.default);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!type) return <Navigate to="/vitals/add" replace />;

  const bpInvalid = type.kind === "bp" && systolic <= diastolic;
  const status = type.kind === "bp" && !bpInvalid ? bpStatus(systolic, diastolic) : null;

  const save = async (e) => {
    e.preventDefault();
    if (bpInvalid) return;
    setSaving(true);
    setError("");
    try {
      await saveReading(type.id, { systolic, diastolic, value });
      navigate(`/vitals/history/${type.id}`);
    } catch (err) {
      setError(err.errors?.map((x) => x.message).join(" ") || err.message);
      setSaving(false);
    }
  };

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar />

        <Link to="/vitals" className="sabi-vitals-crumb"><ArrowLeft size={14} /> Back to Vitals</Link>

        <div className="sabi-vitals-form-header">
          <h1>Add {type.label}</h1>
          <p>Record your {type.label.toLowerCase()} reading. It&apos;s saved to your Sabi health record with the current time.</p>
        </div>

        <form className="sabi-vitals-form-card" onSubmit={save}>
          {status && (
            <div className={"sabi-vitals-status sabi-vitals-status-" + status.tone}>
              <Info size={18} />
              <div>
                <div className="sabi-vitals-status-eyebrow">Guidance</div>
                <div className="sabi-vitals-status-label">{status.label}</div>
              </div>
              <span className="sabi-vitals-status-note">{status.note}</span>
            </div>
          )}

          {type.kind === "bp" ? (
            <>
              <div className="sabi-vitals-slider-block">
                <div className="sabi-vitals-slider-head">
                  <label htmlFor="systolic">Systolic (mmHg)</label>
                  <span className="sabi-vitals-slider-value">{systolic}</span>
                </div>
                <input id="systolic" type="range" min={70} max={220} value={systolic} onChange={(e) => setSystolic(Number(e.target.value))} className="sabi-vitals-slider" />
                <div className="sabi-vitals-slider-scale"><span>70</span><span>120</span><span>220</span></div>
              </div>
              <div className="sabi-vitals-slider-block">
                <div className="sabi-vitals-slider-head">
                  <label htmlFor="diastolic">Diastolic (mmHg)</label>
                  <span className="sabi-vitals-slider-value">{diastolic}</span>
                </div>
                <input id="diastolic" type="range" min={40} max={130} value={diastolic} onChange={(e) => setDiastolic(Number(e.target.value))} className="sabi-vitals-slider" />
                <div className="sabi-vitals-slider-scale"><span>40</span><span>80</span><span>130</span></div>
              </div>
              {bpInvalid && <p className="sabi-form-error" role="alert">Systolic (top number) must be higher than diastolic (bottom number).</p>}
            </>
          ) : (
            <div className="sabi-vitals-slider-block">
              <div className="sabi-vitals-slider-head">
                <label htmlFor="vital-value">{type.label} ({type.unit})</label>
                <span className="sabi-vitals-slider-value">{value}</span>
              </div>
              <input id="vital-value" type="range" min={type.min} max={type.max} step={type.step} value={value} onChange={(e) => setValue(Number(e.target.value))} className="sabi-vitals-slider" />
              <div className="sabi-vitals-slider-scale"><span>{type.min}</span><span>{type.max}</span></div>
            </div>
          )}

          <div className="sabi-vitals-tip">
            <Lightbulb size={18} />
            <p><strong>Tip:</strong> For the most accurate results, sit quietly for 5 minutes before measuring. Avoid caffeine or exercise 30 minutes prior.</p>
          </div>

          {error && <p className="sabi-form-error" role="alert">{error}</p>}

          <div className="sabi-vitals-form-actions">
            <button type="button" className="sabi-apt-secondary-btn" onClick={() => navigate("/vitals")}>Cancel</button>
            <Button type="submit" variant="primary" className="sabi-apt-secondary-btn" disabled={saving || bpInvalid}>
              {saving ? "Saving…" : "Save Reading"}
            </Button>
          </div>
        </form>

        <p className="sabi-report-disclaimer" style={{ textAlign: "center", maxWidth: 560, margin: "var(--sabi-space-lg) auto" }}>
          Categories follow American Heart Association guidance and are for information only. Please consult a medical professional for diagnosis.
        </p>
      </div>
    </div>
  );
}

export default AddVitalReading;

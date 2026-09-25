import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, Button } from "design-system";
import { Plus, History } from "lucide-react";
import { Sidebar, Topbar } from "../dashboard/components";
import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { useApiData } from "../../api/useApiData";
import { VITAL_TYPES, getVitalType } from "./data";
import { fetchLatestReadings } from "./vitalsStore";
import "../dashboard/Dashboard.css";
import "./Vitals.css";

const display = (type, r) => (type.kind === "bp" ? `${r.systolic}/${r.diastolic}` : `${r.value}`);

export function VitalsHub() {
  const [zoom] = useZoom();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApiData(fetchLatestReadings, []);
  const newestType = data?.newest ? getVitalType(data.newest.typeId) : null;

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar placeholder="Search health metrics..." />

        <div className="sabi-apt-header">
          <div>
            <h1>Vitals</h1>
            <p>Record your readings and review your history. Readings are saved to your Sabi health record.</p>
          </div>
          <Button variant="primary" onClick={() => navigate("/vitals/add")}>
            <Plus size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />
            Add Vital Reading
          </Button>
        </div>

        {error && (
          <p className="sabi-form-error" role="alert">
            Couldn&apos;t load your readings: {error.message}{" "}
            <button type="button" className="sabi-apt-secondary-btn" onClick={reload}>Retry</button>
          </p>
        )}

        <div className="sabi-vitalshub-top">
          <Card>
            <div className="sabi-vitalshub-alert-icon"><History size={18} /></div>
            <div className="sabi-vitalshub-alert-title">Last Added Reading</div>
            <div className="sabi-vitalshub-alert-value">{loading ? "…" : newestType ? newestType.label : "None yet"}</div>
            <div className="sabi-vitalshub-alert-sub">
              {data?.newest && newestType ? `${display(newestType, data.newest)} ${newestType.unit} · ${data.newest.date}, ${data.newest.time}` : "Add your first reading to start your history."}
            </div>
          </Card>
        </div>

        <div className="sabi-vitalshub-grid">
          {VITAL_TYPES.map((type) => {
            const latest = data?.latest?.[type.id];
            return (
              <Card key={type.id} className="sabi-vitalshub-card">
                <div className="sabi-vitalshub-card-head">
                  <div className="sabi-vitalshub-card-icon"><type.icon size={16} /></div>
                  {latest && <span className="sabi-vitalhist-pill">{latest.date}</span>}
                </div>
                <div className="sabi-vitalshub-card-label">{type.label}</div>
                <div className="sabi-vitalshub-card-value">
                  {loading ? "…" : latest ? <>{display(type, latest)} <small>{type.unit}</small></> : <small>No readings yet</small>}
                </div>
                <Link to={latest ? `/vitals/history/${type.id}` : `/vitals/add/${type.id}`} className="sabi-vitalshub-card-link">
                  {latest ? "View History ›" : "Add Reading ›"}
                </Link>
              </Card>
            );
          })}
        </div>

        <p className="sabi-report-disclaimer" style={{ textAlign: "center", maxWidth: 560, margin: "var(--sabi-space-lg) auto" }}>
          Self-recorded readings are for tracking only and are not a diagnosis. Contact a clinician if a reading concerns you.
        </p>
      </div>
    </div>
  );
}

export default VitalsHub;

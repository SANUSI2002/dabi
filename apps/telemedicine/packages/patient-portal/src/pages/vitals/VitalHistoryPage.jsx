import React from "react";
import { useParams, useNavigate, Link, Navigate } from "react-router-dom";
import { Card, Button } from "design-system";
import { ArrowLeft, Download, Plus, CheckCircle2, AlertCircle, AlertOctagon } from "lucide-react";
import { Sidebar, Topbar } from "../dashboard/components";
import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { useApiData } from "../../api/useApiData";
import { getVitalType } from "./data";
import { fetchReadings } from "./vitalsStore";
import "../dashboard/Dashboard.css";
import "./Vitals.css";

// American Heart Association adult categories (guidance only).
function bpStatus(systolic, diastolic) {
  if (systolic < 120 && diastolic < 80) return { label: "Normal", tone: "good" };
  if (systolic < 130 && diastolic < 80) return { label: "Elevated", tone: "warn" };
  if (systolic < 140 && diastolic < 90) return { label: "Stage 1", tone: "warn" };
  return { label: "Stage 2", tone: "danger" };
}

const STATUS_ICON = { good: CheckCircle2, warn: AlertCircle, danger: AlertOctagon };
const readingValue = (type, r) => (type.kind === "bp" ? `${r.systolic}/${r.diastolic}` : `${r.value}`);
const readingNumeric = (type, r) => (type.kind === "bp" ? r.systolic : r.value);

export function VitalHistoryPage() {
  const { type: typeId } = useParams();
  const navigate = useNavigate();
  const [zoom] = useZoom();
  const type = getVitalType(typeId);
  const { data, loading, error, reload } = useApiData(() => fetchReadings(typeId), [typeId]);

  if (!type) return <Navigate to="/vitals" replace />;
  const readings = data || [];

  const handleExport = () => {
    const lines = readings.map((r) => `${r.date} ${r.time} — ${readingValue(type, r)} ${type.unit}`);
    const blob = new Blob([`${type.label} History (self-recorded)\n\n${lines.join("\n")}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type.id}-history.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const values = readings.map((r) => readingNumeric(type, r));
  const average = values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(type.kind === "bp" ? 0 : 1) : "—";
  const avgDiastolic = type.kind === "bp" && readings.length ? Math.round(readings.reduce((a, r) => a + r.diastolic, 0) / readings.length) : null;
  const peak = readings.length ? readings.reduce((a, b) => (readingNumeric(type, a) >= readingNumeric(type, b) ? a : b)) : null;
  const lowest = readings.length ? readings.reduce((a, b) => (readingNumeric(type, a) <= readingNumeric(type, b) ? a : b)) : null;
  const chartMax = Math.max(...values, 1) * 1.15;
  const chartReadings = readings.slice(0, 14).reverse();

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar />

        <Link to="/vitals" className="sabi-vitals-crumb"><ArrowLeft size={14} /> Vitals Dashboard</Link>

        <div className="sabi-apt-header">
          <div>
            <h1>{type.label} History</h1>
            <p>Your recorded readings, newest first.</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="sabi-apt-secondary-btn" onClick={handleExport} disabled={!readings.length}>
              <Download size={15} style={{ marginRight: 6 }} /> Export
            </button>
            <Button variant="primary" onClick={() => navigate(`/vitals/add/${type.id}`)}>
              <Plus size={15} style={{ verticalAlign: "-3px", marginRight: 6 }} /> Add New Reading
            </Button>
          </div>
        </div>

        {error && (
          <p className="sabi-form-error" role="alert">
            Couldn&apos;t load readings: {error.message} <button type="button" className="sabi-apt-secondary-btn" onClick={reload}>Retry</button>
          </p>
        )}

        <div className="sabi-grid sabi-vitalhist-grid">
          <div className="sabi-col sabi-vitalhist-stats">
            <Card className="sabi-vitalhist-stat sabi-vitalhist-stat-avg">
              <div className="sabi-vitalhist-stat-label">Average</div>
              <div className="sabi-vitalhist-stat-value">{type.kind === "bp" && avgDiastolic != null ? `${average}/${avgDiastolic}` : average} <small>{type.unit}</small></div>
            </Card>
            <Card className="sabi-vitalhist-stat sabi-vitalhist-stat-peak">
              <div className="sabi-vitalhist-stat-label">Highest Reading</div>
              <div className="sabi-vitalhist-stat-value">{peak ? readingValue(type, peak) : "—"} <small>{type.unit}</small></div>
              {peak && <div className="sabi-vitalhist-stat-meta">Recorded {peak.date}, {peak.time}</div>}
            </Card>
            <Card className="sabi-vitalhist-stat sabi-vitalhist-stat-low">
              <div className="sabi-vitalhist-stat-label">Lowest Reading</div>
              <div className="sabi-vitalhist-stat-value">{lowest ? readingValue(type, lowest) : "—"} <small>{type.unit}</small></div>
              {lowest && <div className="sabi-vitalhist-stat-meta">Recorded {lowest.date}, {lowest.time}</div>}
            </Card>
          </div>

          <Card className="sabi-vitalhist-chart">
            <h3>Trend</h3>
            <p className="sabi-vitalhist-chart-sub">{type.kind === "bp" ? "Systolic, " : ""}last {chartReadings.length || 0} readings</p>
            {readings.length === 0 ? (
              <p className="sabi-modal-empty">{loading ? "Loading…" : "No readings yet — add your first one to see a trend."}</p>
            ) : (
              <div className="sabi-vitalhist-bars">
                {chartReadings.map((r) => (
                  <div className="sabi-vitalhist-bar-col" key={r.id}>
                    <div className="sabi-vitalhist-bar" style={{ height: `${(readingNumeric(type, r) / chartMax) * 100}%` }} title={`${readingValue(type, r)} ${type.unit} · ${r.date}`} />
                    <span>{r.date.split(" ").slice(0, 2).join(" ")}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card>
          <h3 className="sabi-vitalhist-table-title">Logged Readings</h3>
          {readings.length === 0 ? (
            <p className="sabi-modal-empty">{loading ? "Loading…" : "Nothing recorded yet."}</p>
          ) : (
            <div className="sabi-vitalhist-table-wrap">
              <table className="sabi-vitalhist-table">
                <thead>
                  <tr>
                    <th>Date &amp; Time</th>
                    <th>Reading</th>
                    {type.kind === "bp" && <th>Category</th>}
                  </tr>
                </thead>
                <tbody>
                  {readings.map((r) => {
                    const status = type.kind === "bp" ? bpStatus(r.systolic, r.diastolic) : null;
                    const StatusIcon = status ? STATUS_ICON[status.tone] : null;
                    return (
                      <tr key={r.id}>
                        <td>
                          <div className="sabi-vitalhist-cell-strong">{r.date}</div>
                          <div className="sabi-vitalhist-cell-muted">{r.time}</div>
                        </td>
                        <td>
                          <span className={"sabi-vitalhist-reading" + (status ? " tone-" + status.tone : "")}>{readingValue(type, r)}</span>{" "}
                          <span className="sabi-vitalhist-cell-muted">{type.unit}</span>
                        </td>
                        {status && (
                          <td><span className={"sabi-vitalhist-pill tone-" + status.tone}><StatusIcon size={12} /> {status.label}</span></td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default VitalHistoryPage;

import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, Button } from "design-system";
import { ArrowLeft, Download, Plus, Trash2, TrendingDown, TrendingUp, CheckCircle2, AlertCircle, AlertOctagon } from "lucide-react";
import { Sidebar, Topbar } from "../dashboard/components";
import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { getVitalType } from "./data";
import { getReadings, removeReading } from "./vitalsStore";
import "../dashboard/Dashboard.css";
import "./Vitals.css";

function bpStatus(systolic, diastolic) {
  if (systolic < 120 && diastolic < 80) return { label: "Normal", tone: "good" };
  if (systolic < 130 && diastolic < 80) return { label: "Elevated", tone: "warn" };
  if (systolic < 140 || diastolic < 90) return { label: "Stage 1", tone: "warn" };
  return { label: "Stage 2", tone: "danger" };
}

const STATUS_ICON = { good: CheckCircle2, warn: AlertCircle, danger: AlertOctagon };

function readingValue(type, r) {
  return type.kind === "bp" ? `${r.systolic}/${r.diastolic}` : `${r.value}`;
}

function readingNumeric(type, r) {
  return type.kind === "bp" ? r.systolic : r.value;
}

export function VitalHistoryPage() {
  const { type: typeId } = useParams();
  const navigate = useNavigate();
  const [zoom] = useZoom();
  const type = getVitalType(typeId);
  const [readings, setReadings] = useState(() => getReadings(type.id));
  const [deleteReadingId, setDeleteReadingId] = useState(null);

  useEffect(() => {
    setReadings(getReadings(type.id));
  }, [type.id]);

  const handleDelete = () => {
    if (deleteReadingId) {
      setReadings(removeReading(type.id, deleteReadingId));
      setDeleteReadingId(null);
    }
  };

  const handleExport = () => {
    const lines = readings.map((r) => `${r.date} ${r.time} — ${readingValue(type, r)} ${type.unit}${r.notes ? " — " + r.notes : ""}`);
    const blob = new Blob([`${type.label} History\n\n${lines.join("\n")}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type.id}-history.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const values = readings.map((r) => readingNumeric(type, r));
  const average = values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(type.kind === "bp" ? 0 : 1) : "—";
  const avgDiastolic =
    type.kind === "bp" && readings.length
      ? Math.round(readings.reduce((a, r) => a + r.diastolic, 0) / readings.length)
      : null;
  const peak = readings.length ? readings.reduce((a, b) => (readingNumeric(type, a) > readingNumeric(type, b) ? a : b)) : null;
  const lowest = readings.length ? readings.reduce((a, b) => (readingNumeric(type, a) < readingNumeric(type, b) ? a : b)) : null;

  const chartMax = Math.max(...values, 1) * 1.15;

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar />

        <Link to="/vitals" className="sabi-vitals-crumb">
          <ArrowLeft size={14} /> Vitals Dashboard
        </Link>

        <div className="sabi-apt-header">
          <div>
            <h1>{type.label} History</h1>
            <p>Review your historical readings and track your progress over time with clinical precision.</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="sabi-apt-secondary-btn" onClick={handleExport}>
              <Download size={15} style={{ marginRight: 6 }} /> Export Report
            </button>
            <Button variant="primary" onClick={() => navigate(`/vitals/add/${type.id}`)}>
              <Plus size={15} style={{ verticalAlign: "-3px", marginRight: 6 }} />
              Add New Reading
            </Button>
          </div>
        </div>

        <div className="sabi-grid sabi-vitalhist-grid">
          <div className="sabi-col sabi-vitalhist-stats">
            <Card className="sabi-vitalhist-stat sabi-vitalhist-stat-avg">
              <div className="sabi-vitalhist-stat-label">Average</div>
              <div className="sabi-vitalhist-stat-value">
                {type.kind === "bp" ? `${average}/${avgDiastolic}` : average} <small>{type.unit}</small>
              </div>
            </Card>
            <Card className="sabi-vitalhist-stat sabi-vitalhist-stat-peak">
              <div className="sabi-vitalhist-stat-label">Peak Reading</div>
              <div className="sabi-vitalhist-stat-value">
                {peak ? readingValue(type, peak) : "—"} <small>{type.unit}</small>
              </div>
              {peak && <div className="sabi-vitalhist-stat-meta">Recorded {peak.date}, {peak.time}</div>}
            </Card>
            <Card className="sabi-vitalhist-stat sabi-vitalhist-stat-low">
              <div className="sabi-vitalhist-stat-label">Lowest Reading</div>
              <div className="sabi-vitalhist-stat-value">
                {lowest ? readingValue(type, lowest) : "—"} <small>{type.unit}</small>
              </div>
              {lowest && <div className="sabi-vitalhist-stat-meta">Recorded {lowest.date}, {lowest.time}</div>}
            </Card>
          </div>

          <Card className="sabi-vitalhist-chart">
            <h3>Trend Analysis</h3>
            <p className="sabi-vitalhist-chart-sub">Recent variation across your logged readings</p>
            {readings.length === 0 ? (
              <p className="sabi-modal-empty">No readings yet — add your first one to see a trend.</p>
            ) : (
              <div className="sabi-vitalhist-bars">
                {[...readings].reverse().map((r) => (
                  <div className="sabi-vitalhist-bar-col" key={r.id}>
                    <div
                      className="sabi-vitalhist-bar"
                      style={{ height: `${(readingNumeric(type, r) / chartMax) * 100}%` }}
                      title={`${readingValue(type, r)} ${type.unit}`}
                    />
                    <span>{r.date.split(",")[0]}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card>
          <h3 className="sabi-vitalhist-table-title">Logged Readings</h3>
          {readings.length === 0 ? (
            <p className="sabi-modal-empty">Nothing recorded yet.</p>
          ) : (
            <div className="sabi-vitalhist-table-wrap">
              <table className="sabi-vitalhist-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Reading</th>
                    {type.kind === "bp" && <th>Status</th>}
                    <th>Tags & Source</th>
                    <th>Actions</th>
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
                          <span className={"sabi-vitalhist-reading" + (status ? " tone-" + status.tone : "")}>
                            {readingValue(type, r)}
                          </span>{" "}
                          <span className="sabi-vitalhist-cell-muted">{type.unit}</span>
                        </td>
                        {type.kind === "bp" && (
                          <td>
                            <span className={"sabi-vitalhist-pill tone-" + status.tone}>
                              <StatusIcon size={12} /> {status.label}
                            </span>
                          </td>
                        )}
                        <td>
                          {r.tags && r.tags.length > 0 && (
                            <span className="sabi-vitalhist-tag">{r.tags[0]}</span>
                          )}
                          <div className="sabi-vitalhist-cell-muted">{r.source}</div>
                        </td>
                        <td>
                          <button
                           type="button" 
                           className="sabi-cat-record-remove" aria-label="Delete reading" 
                           onClick={() => setDeleteReadingId(r.id)}>
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

          {deleteReadingId && (
  <div
    className="sabi-modal-backdrop"
    onClick={() => setDeleteReadingId(null)}
  >
    <div
      className="sabi-confirm-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="sabi-confirm-icon danger">
        <Trash2 size={28} />
      </div>

      <h3>Delete Reading?</h3>

      <p>
        Are you sure you want to permanently delete this vital reading?
        This action cannot be undone.
      </p>

      <div className="sabi-confirm-actions">
        <Button
          variant="secondary"
          onClick={() => setDeleteReadingId(null)}
        >
          Cancel
        </Button>

        <Button
          variant="danger"
          onClick={handleDelete}
        >
          Delete Reading
        </Button>
      </div>
    </div>
  </div>
)}


      </div>
    </div>
  );
}

export default VitalHistoryPage;

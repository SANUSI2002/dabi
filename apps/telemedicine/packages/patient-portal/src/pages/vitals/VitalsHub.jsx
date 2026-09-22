import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, Button } from "design-system";
import { Plus, BellRing, History, Sparkles, Download, CheckCircle2 } from "lucide-react";
import { Sidebar, Topbar } from "../dashboard/components";
import { SectionTitle, ScoreDonut } from "../dashboard/share";
import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { VITAL_TYPES, VITALS_SUMMARY, getVitalType } from "./data";
import "../dashboard/Dashboard.css";
import "./Vitals.css";

const BP_WEEK = [
  { day: "Mon", value: 118 },
  { day: "Tue", value: 121 },
  { day: "Wed", value: 124 },
  { day: "Thu", value: 116 },
  { day: "Fri", value: 128 },
  { day: "Sat", value: 122 },
  { day: "Sun", value: 132 },
];

const AI_INSIGHTS = [
  "Your resting heart rate is gradually improving (down 3bpm since last month).",
  "Sleep quality has increased by 15% due to consistent sleep-wake cycles.",
];

export function VitalsHub() {
  const [zoom] = useZoom();
  const navigate = useNavigate();
  const chartMax = Math.max(...BP_WEEK.map((d) => d.value)) * 1.15;

  const handleExportReport = () => {
    const lines = AI_INSIGHTS.map((t) => `- ${t}`);
    const blob = new Blob([`Sabi Health — Vitals Report\n\n${lines.join("\n")}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vitals-report.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar placeholder="Search health metrics..." />

        <div className="sabi-apt-header">
          <div>
            <h1>Vital History</h1>
            <p>Monitor your health, discover trends, and stay informed with real-time health insights.</p>
          </div>
          <Button variant="primary" onClick={() => navigate("/vitals/add")}>
            <Plus size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />
            Add Vital Reading
          </Button>
        </div>

        <div className="sabi-vitalshub-top">
          <Card className="sabi-vitalshub-score">
            <SectionTitle center eyebrow>Overall Health Score</SectionTitle>
            <ScoreDonut score={91} />
            <div className="sabi-vitalshub-score-trend">↗ Improved 5% this month</div>
            <span className="sabi-vitalhist-pill tone-good" style={{ marginTop: 8 }}>Risk Level: Low</span>
          </Card>

          <Card>
            <div className="sabi-vitalshub-alert-icon"><BellRing size={18} /></div>
            <div className="sabi-vitalshub-alert-title">Health Alerts</div>
            <div className="sabi-vitalshub-alert-value">None</div>
            <div className="sabi-vitalshub-alert-sub"><CheckCircle2 size={13} /> Everything looks normal</div>
          </Card>

          <Card>
            <div className="sabi-vitalshub-alert-icon"><History size={18} /></div>
            <div className="sabi-vitalshub-alert-title">Last Added Reading</div>
            <div className="sabi-vitalshub-alert-value">Blood Pressure</div>
            <div className="sabi-vitalshub-alert-sub">Manual Entry</div>
          </Card>
        </div>

        <div className="sabi-vitalshub-grid">
          {VITALS_SUMMARY.map((s) => {
            const type = getVitalType(s.id);
            return (
              <Card key={s.id} className="sabi-vitalshub-card">
                <div className="sabi-vitalshub-card-head">
                  <div className="sabi-vitalshub-card-icon">
                    <type.icon size={16} />
                  </div>
                  <span className="sabi-vitalhist-pill tone-good">{s.status}</span>
                </div>
                <div className="sabi-vitalshub-card-label">{type.label}</div>
                <div className="sabi-vitalshub-card-value">
                  {s.value} <small>{type.unit}</small>
                </div>
                <Link to={`/vitals/history/${type.id}`} className="sabi-vitalshub-card-link">
                  View History ›
                </Link>
              </Card>
            );
          })}
        </div>

        <div className="sabi-grid sabi-vitalshub-bottom">
          <Card>
            <div className="sabi-vitalshub-chart-head">
              <div>
                <h3>Blood Pressure Analytics</h3>
                <p className="sabi-vitalhist-chart-sub">Weekly trend, systolic average</p>
              </div>
            </div>
            <div className="sabi-vitalhist-bars sabi-vitalshub-bars">
              {BP_WEEK.map((d) => (
                <div className="sabi-vitalhist-bar-col" key={d.day}>
                  <div className="sabi-vitalhist-bar" style={{ height: `${(d.value / chartMax) * 100}%` }} title={`${d.value} mmHg`} />
                  <span>{d.day}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="sabi-vitalshub-ai">
            <div className="sabi-vitalshub-ai-head">
              <Sparkles size={18} />
              <h3>AI Health Insights</h3>
            </div>
            <p className="sabi-vitalshub-ai-quote">
              "Your blood pressure has remained stable for the past three weeks. Medication impact: Positive."
            </p>
            <ul className="sabi-vitalshub-ai-list">
              {AI_INSIGHTS.map((t) => (
                <li key={t}><CheckCircle2 size={14} /> {t}</li>
              ))}
            </ul>
            <button type="button" className="sabi-healthinsight-cta" onClick={handleExportReport}>
              <Download size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
              Download Full Report
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default VitalsHub;

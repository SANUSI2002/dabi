import React, { useMemo, useState, useSyncExternalStore } from "react";
import { ChevronLeft, FileText } from "lucide-react";
import { PageTransition } from "design-system";
import PortalLayout from "../../components/PortalLayout";
import { getReports, subscribeToReports, sendReport, updateReport } from "../../store/reportStore";
import LabOrderFields from "../../components/LabOrderFields";
import { addActivity } from "../../store/activityStore";
import "../dashboard/DashboardModals.css";
import "./ReportsPage.css";

const FILTERS = ["All", "Draft", "Finalized", "Sent"];

function ReportDetail({ report, onBack }) {
  const [summary, setSummary] = useState(report.diagnosisSummary || "");
  const [plan, setPlan] = useState(report.treatmentPlan || "");
  const [labOrders, setLabOrders] = useState(report.labOrders || []);
  const readOnly = report.status !== "draft";
  const [message, setMessage] = useState(
    report.patientMessage ||
      `Hi ${report.patientName.split(" ")[0]},\n\nIt was good seeing you today. Summary: ${report.diagnosisSummary}.\n\n${report.treatmentPlan ? `Plan: ${report.treatmentPlan}\n\n` : ""}Please reach out if you have any questions.`
  );

  function saveDraft() {
    updateReport(report.id, { patientMessage: message, diagnosisSummary: summary, treatmentPlan: plan, labOrders, status: "draft" });
    addActivity(`Saved draft report for ${report.patientName}.`);
    onBack();
  }
  function send() {
    if (!sendReport(report.id, message)) return;
    addActivity(`Sent consultation report to ${report.patientName}.`);
    onBack();
  }

  return (
    <PageTransition className="dp-report-detail">
      <button className="dp-link-btn dp-report-back" onClick={onBack}>
        <ChevronLeft size={15} /> Back to Reports
      </button>
      <div className="dp-report-detail-header">
        <h1>Review Consultation Report</h1>
        <span className="dp-tag dp-tag-neutral">{report.status === "draft" ? "Auto-Generated Draft" : report.status}</span>
      </div>

      <div className="dp-panel dp-report-patient-card">
        <strong>{report.patientName}</strong>
        <span>{report.consultationDate}</span>
      </div>

      <div className="dp-report-layout">
        <div className="dp-panel">
          <div className="dp-report-section-label">Clinical Structured Data</div>
          {report.subjective && <div className="dp-report-field"><span>Subjective / Chief Complaint</span><p style={{ whiteSpace: "pre-wrap" }}>{report.subjective}</p></div>}
          {report.objective && <div className="dp-report-field"><span>Objective Findings</span><p style={{ whiteSpace: "pre-wrap" }}>{report.objective}</p></div>}
          <div className="dp-report-field">
            <span>Primary Diagnosis</span>
            <textarea className="dp-report-message" aria-label="Diagnosis summary" rows={3} readOnly={readOnly} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </div>
          {(
            <div className="dp-report-field">
              <span>Treatment Plan</span>
              <textarea className="dp-report-message" aria-label="Treatment plan" rows={3} readOnly={readOnly} value={plan} onChange={(e) => setPlan(e.target.value)} />
            </div>
          )}
        </div>

        <div className="dp-panel">
          <div className="dp-report-section-label">Patient-Facing Summary</div>
          <textarea className="dp-report-message" aria-label="Patient-facing summary" rows={10} readOnly={readOnly} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
      </div>

      {!readOnly ? <LabOrderFields orders={labOrders} onChange={setLabOrders} /> : labOrders.map((o, i) => <div className="dp-panel" key={i}><strong>Lab order: {o.test}</strong><p>{o.urgency} · {o.instructions}</p></div>)}
      <p>Finalize this report, then send it to the patient. It will appear in their Prescriptions tab with their consultation documents.</p>
      <div className="dp-modal-actions">
        {report.status === "draft" && <><button className="dp-btn dp-btn-outline" onClick={saveDraft}>Save Draft</button><button className="dp-btn dp-btn-primary" disabled={!message.trim() || labOrders.some((o) => !o.test.trim())} onClick={() => updateReport(report.id, { status: "finalized", patientMessage: message, diagnosisSummary: summary, treatmentPlan: plan, labOrders })}>Finalize Report</button></>}
        {report.status === "finalized" && <><button className="dp-btn dp-btn-outline" onClick={() => updateReport(report.id, { status: "draft" })}>Back to Edit</button><button className="dp-btn dp-btn-primary" onClick={send}>Send to Patient</button></>}
        {report.status === "sent" && <span className="dp-tag dp-tag-success">Sent to {report.patientName}</span>}
      </div>
    </PageTransition>
  );
}

export function ReportsPage() {
  const reports = useSyncExternalStore(subscribeToReports, getReports, getReports);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);

  const filtered = useMemo(
    () =>
      reports
        .filter((r) => (filter === "All" ? true : r.status === filter.toLowerCase()))
        .filter((r) => r.patientName.toLowerCase().includes(query.toLowerCase())),
    [reports, filter, query]
  );

  const openReport = reports.find((r) => r.id === openId);

  if (openReport) {
    return (
      <PortalLayout topbarProps={{ placeholder: "Search patients, reports..." }}>
        <ReportDetail report={openReport} onBack={() => setOpenId(null)} />
      </PortalLayout>
    );
  }

  return (
    <PortalLayout topbarProps={{ placeholder: "Search patients, reports..." }}>
      <PageTransition className="dp-reports-page">
        <div className="dp-reports-heading">
          <div>
            <h1>
              <FileText size={20} /> Consultation Reports
            </h1>
            <p>Manage and publish formal write-ups for your patients.</p>
          </div>
        </div>

        <div className="dp-appt-filters">
          <input className="dp-appt-search" placeholder="Search by patient name..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="dp-tabs dp-reports-filter-tabs">
            {FILTERS.map((f) => (
              <button key={f} className={`dp-tab${filter === f ? " dp-tab-active" : ""}`} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="dp-empty">No reports yet — they're created automatically when you save or finish a consultation.</p>
        ) : (
          <div className="dp-rx-table">
            <div className="dp-rx-table-header dp-report-table-header">
              <span>Patient</span>
              <span>Date</span>
              <span>Diagnosis Summary</span>
              <span>Status</span>
              <span>Action</span>
            </div>
            {filtered.map((r) => (
              <div className="dp-rx-table-row dp-report-table-row" key={r.id}>
                <span className="dp-report-patient-cell">
                  <span className="dp-patient-avatar dp-report-avatar" style={{ background: "#0B5E48" }}>
                    {r.patientName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                  <span className="dp-rx-patient-name">{r.patientName}</span>
                </span>
                <span>{r.consultationDate}</span>
                <span>{r.diagnosisSummary}</span>
                <span className={`dp-tag ${r.status === "sent" ? "dp-tag-success" : r.status === "draft" ? "dp-tag-warning" : "dp-tag-neutral"}`}>
                  {r.status}
                </span>
                <button className="dp-text-btn" onClick={() => setOpenId(r.id)}>
                  {r.status === "draft" ? "Review Draft" : "View Report"}
                </button>
              </div>
            ))}
          </div>
        )}
      </PageTransition>
    </PortalLayout>
  );
}

export default ReportsPage;

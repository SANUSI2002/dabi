import React, { useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { getPrescriptions, subscribeToPrescriptions } from "../../store/prescriptionStore";
import { getReports, subscribeToReports } from "../../store/reportStore";
import "./PrescriptionsPage.css";
export default function PatientPrescriptionsPage() {
  const prescriptions = useSyncExternalStore(subscribeToPrescriptions, getPrescriptions, getPrescriptions);
  const reports = useSyncExternalStore(subscribeToReports, getReports, getReports);
  const names = [...new Set([...prescriptions, ...reports].map((r) => r.patientName))];
  const [selected, setSelected] = useState("");
  const patient = selected || names[0] || "";
  const sentRx = prescriptions.filter((r) => r.patientName === patient && r.patientStatus === "sent");
  const sentReports = reports.filter((r) => r.patientName === patient && r.status === "sent");
  return <main className="dp-patient-preview"><Link to="/prescriptions">← Back to Doctor Portal</Link><h1>Prescriptions</h1><p>Patient view preview · local demo</p><label className="dp-rx-field">Patient<select value={patient} onChange={(e) => setSelected(e.target.value)}>{names.map((name) => <option key={name}>{name}</option>)}</select></label>
    {sentRx.length + sentReports.length === 0 && <p className="dp-empty">No prescriptions or consultation reports have been sent to this patient.</p>}
    {sentRx.map((rx) => <article className="dp-panel dp-rx-panel" key={rx.id}><h2>Prescription · {rx.rxId}</h2><p>{rx.diagnosisLabel}</p>{rx.medications.map((m, i) => <div className="dp-med-card" key={i}><strong>{m.drug} {m.dosage}</strong><p>{[m.frequency, m.duration, m.quantity && m.quantity + " units"].filter(Boolean).join(" · ")}</p><p>{m.instructions}</p></div>)}<p style={{ whiteSpace: "pre-wrap" }}>{rx.notes}</p>{(rx.labOrders || []).map((o, i) => <div className="dp-med-card" key={i}><strong>Lab order: {o.test}</strong><p>{o.urgency} · {o.instructions}</p></div>)}</article>)}
    {sentReports.map((r) => <article className="dp-panel dp-rx-panel" key={r.id}><h2>Consultation Report</h2><p>{r.consultationDate}</p><p>{r.diagnosisSummary}</p><p style={{ whiteSpace: "pre-wrap" }}>{r.patientMessage}</p>{(r.labOrders || []).map((o, i) => <div className="dp-med-card" key={i}><strong>Lab order: {o.test}</strong><p>{o.urgency} · {o.instructions}</p></div>)}</article>)}
  </main>;
}

import React, { useMemo, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "react-router-dom";
import { FileEdit, ClipboardEdit, ChevronLeft, Plus, Trash2, Lock, ShieldAlert, CheckCircle2 } from "lucide-react";
import { PageTransition } from "design-system";
import PortalLayout from "../../components/PortalLayout";
import { useDoctorAppointments } from "../../hooks/useDoctorAppointments";
import { useDiagnoses } from "../../hooks/useDiagnoses";
import { getPrescriptions, subscribeToPrescriptions, addPrescription, updatePrescription, sendToPatient } from "../../store/prescriptionStore";
import LabOrderFields from "../../components/LabOrderFields";
import { Link } from "react-router-dom";
import { addActivity } from "../../store/activityStore";
import { DOCTOR_PROFILE } from "../../data/doctorProfile";
import { allergiesFor } from "../../utils/patientInfo";
import "../dashboard/DashboardModals.css";
import "./PrescriptionsPage.css";

const EMPTY_MED = { drug: "", dosage: "", frequency: "", quantity: "", duration: "", instructions: "" };

function Composer({ onClose, onIssued, draft }) {
  const appointments = useDoctorAppointments();
  const diagnoses = useDiagnoses();
  const patientNames = useMemo(
    () => [...new Set(appointments.filter((a) => a.patientName && a.status !== "declined").map((a) => a.patientName))].sort(),
    [appointments]
  );

  const [step, setStep] = useState(draft ? 3 : 1);
  const [patientName, setPatientName] = useState(draft?.patientName || "");
  const [diagnosisId, setDiagnosisId] = useState(draft?.diagnosisId || "");
  const [medications, setMedications] = useState(draft?.medications?.length ? draft.medications : [{ ...EMPTY_MED }]);
  const [notes, setNotes] = useState(draft?.notes || "");
  const [labOrders, setLabOrders] = useState(draft?.labOrders || []);
  const [savedId, setSavedId] = useState(draft?.id);
  const [saveMessage, setSaveMessage] = useState("");
  const [ackOverride, setAckOverride] = useState({});
  const [genericSub, setGenericSub] = useState(draft?.genericSub ?? true);

  const patientAllergies = allergiesFor(patientName);

  const patientDiagnoses = diagnoses.filter((d) => d.patientName === patientName);
  const ownDiagnoses = patientDiagnoses.filter((d) => d.authoredByCurrentDoctor);
  const selectedDiagnosis = patientDiagnoses.find((d) => d.id === diagnosisId);

  function updateMed(i, patch) {
    setMedications((meds) => meds.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }
  function addMed() {
    setMedications((meds) => [...meds, { ...EMPTY_MED }]);
  }
  function removeMed(i) {
    setMedications((meds) => meds.filter((_, idx) => idx !== i));
  }

  function save(status = "draft") {
    const data = { patientName, diagnosisId, diagnosisLabel: selectedDiagnosis?.label || draft?.diagnosisLabel, medications: medications.filter((m) => m.drug.trim()), notes, labOrders, genericSub, status };
    const rx = savedId ? updatePrescription(savedId, data) : addPrescription(data);
    setSavedId(rx.id);
    addActivity(`${status === "draft" ? "Saved draft" : "Finalized prescription"} ${rx.rxId} for ${patientName}.`);
    if (status === "finalized") onIssued(rx); else setSaveMessage("Draft saved. You can return to it from Prescriptions.");
  }

  return (
    <PageTransition className="dp-rx-composer">
      <button className="dp-link-btn dp-rx-back" onClick={onClose}>
        <ChevronLeft size={15} /> Back to Prescriptions
      </button>
      <h1>{draft ? "Review Prescription Draft" : "New Prescription"}</h1>
      {saveMessage && <p role="status">{saveMessage}</p>}
      <button className="dp-btn dp-btn-outline" disabled={!patientName} onClick={() => save()}>Save Draft</button>

      <div className="dp-rx-steps">
        {["Patient", "Diagnosis", "Medications", "Review"].map((label, i) => (
          <div key={label} className={`dp-rx-step${step === i + 1 ? " dp-rx-step-active" : ""}${step > i + 1 ? " dp-rx-step-done" : ""}`}>
            {i + 1}. {label}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="dp-panel dp-rx-panel">
          <label className="dp-rx-field">
            Patient
            <select disabled={!!draft?.consultationId} value={patientName} onChange={(e) => { setPatientName(e.target.value); setDiagnosisId(""); }}>
              <option value="" disabled>
                Select a patient
              </option>
              {patientNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div className="dp-modal-actions">
            <button className="dp-btn dp-btn-primary" disabled={!patientName} onClick={() => setStep(2)}>
              Next
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="dp-panel dp-rx-panel">
          <p className="dp-avail-section-sub">
            You can only link a prescription to a diagnosis you made yourself. Diagnoses made by other doctors are shown for
            context but can't be selected.
          </p>
          {patientDiagnoses.length === 0 && <p className="dp-empty">No diagnoses on file for {patientName} yet.</p>}
          <div className="dp-dx-list">
            {patientDiagnoses.map((d) => {
              const linkable = d.authoredByCurrentDoctor;
              return (
                <label key={d.id} className={`dp-dx-row${diagnosisId === d.id ? " dp-dx-row-selected" : ""}${!linkable ? " dp-dx-row-locked" : ""}`}>
                  <input
                    type="radio"
                    name="diagnosis"
                    disabled={!linkable}
                    checked={diagnosisId === d.id}
                    onChange={() => setDiagnosisId(d.id)}
                  />
                  <div className="dp-dx-row-info">
                    <div className="dp-dx-row-label">
                      {d.label} {d.icd10 && <span className="dp-tag dp-tag-neutral">{d.icd10}</span>}
                    </div>
                    <div className="dp-dx-row-sub">
                      {d.doctorName} · {d.date}
                    </div>
                  </div>
                  {!linkable && (
                    <span className="dp-dx-locked-tag">
                      <Lock size={12} /> Not diagnosed by you
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          {ownDiagnoses.length === 0 && patientDiagnoses.length > 0 && (
            <p className="dp-dx-hint">You haven't diagnosed {patientName} yourself yet — link a diagnosis during a consultation first, then come back to prescribe.</p>
          )}
          <div className="dp-modal-actions">
            <button className="dp-btn dp-btn-outline" onClick={() => setStep(1)}>
              Back
            </button>
            <button className="dp-btn dp-btn-primary" disabled={!diagnosisId} onClick={() => setStep(3)}>
              Next
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="dp-panel dp-rx-panel">
          <div className="dp-dx-linked-banner">
            <strong>{selectedDiagnosis?.label}</strong> {selectedDiagnosis?.icd10 && `(${selectedDiagnosis.icd10})`}
          </div>
          {medications.map((med, i) => {
            const conflict = med.drug && patientAllergies.some((a) => med.drug.toLowerCase().includes(a.toLowerCase()));
            const acknowledged = ackOverride[i];
            return (
              <div className="dp-med-card" key={i}>
                <div className="dp-modal-row">
                  <label>
                    Medication
                    <input value={med.drug} onChange={(e) => updateMed(i, { drug: e.target.value })} placeholder="e.g. Lisinopril" />
                  </label>
                  <label>
                    Strength / Dosage
                    <input value={med.dosage} onChange={(e) => updateMed(i, { dosage: e.target.value })} placeholder="10mg" />
                  </label>
                </div>

                {conflict && (
                  <div className="dp-allergy-warning">
                    <ShieldAlert size={16} />
                    <div>
                      <strong>ALLERGY WARNING:</strong> Patient has a recorded allergy to {med.drug}. Proceed with caution.
                      <label className="dp-allergy-ack">
                        <input
                          type="checkbox"
                          checked={!!acknowledged}
                          onChange={(e) => setAckOverride((s) => ({ ...s, [i]: e.target.checked }))}
                        />
                        Doctor Acknowledgment: Override warning and proceed.
                      </label>
                    </div>
                  </div>
                )}

                <div className="dp-modal-row">
                  <label>
                    Frequency
                    <input value={med.frequency} onChange={(e) => updateMed(i, { frequency: e.target.value })} placeholder="Once daily" />
                  </label>
                  <label>
                    Quantity
                    <input value={med.quantity} onChange={(e) => updateMed(i, { quantity: e.target.value })} placeholder="30" />
                  </label>
                </div>
                <div className="dp-modal-row">
                  <label>
                    Duration
                    <input value={med.duration} onChange={(e) => updateMed(i, { duration: e.target.value })} placeholder="30 days" />
                  </label>
                  <label>
                    Patient Instructions
                    <input value={med.instructions} onChange={(e) => updateMed(i, { instructions: e.target.value })} placeholder="Take after food" />
                  </label>
                </div>
                {medications.length > 1 && (
                  <button className="dp-text-btn dp-text-btn-danger dp-med-remove" onClick={() => removeMed(i)}>
                    <Trash2 size={13} /> Remove
                  </button>
                )}
              </div>
            );
          })}
          <button className="dp-btn dp-btn-outline dp-med-add" onClick={addMed}>
            <Plus size={14} /> Add Medication
          </button>
          <label className="dp-rx-field" style={{ marginTop: 16 }}>
            Prescription notes / instructions for patient
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <LabOrderFields orders={labOrders} onChange={setLabOrders} />
          <div className="dp-modal-actions">
            <button className="dp-btn dp-btn-outline" onClick={() => setStep(2)}>
              Back
            </button>
            <button
              className="dp-btn dp-btn-primary"
              disabled={
                (!medications.some((m) => m.drug.trim()) && !notes.trim() && !labOrders.some((o) => o.test.trim())) ||
                medications.some((m) => m.drug.trim() && (!m.dosage.trim() || !m.frequency.trim() || !m.duration.trim())) ||
                labOrders.some((o) => !o.test.trim()) ||
                medications.some(
                  (m, i) => m.drug && patientAllergies.some((a) => m.drug.toLowerCase().includes(a.toLowerCase())) && !ackOverride[i]
                )
              }
              onClick={() => setStep(4)}
            >
              Review
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="dp-panel dp-rx-panel">
          <div className="dp-rx-review-header">
            <div>
              <strong>{patientName}</strong>
            </div>
            <span>{DOCTOR_PROFILE.name}</span>
          </div>
          <div className="dp-dx-linked-banner">
            <strong>{selectedDiagnosis?.label}</strong> {selectedDiagnosis?.icd10 && `(${selectedDiagnosis.icd10})`}
          </div>
          <div className="dp-rx-review-meds">
            {medications.filter((m) => m.drug).map((m, i) => (
              <div className="dp-rx-review-med" key={i}>
                <div className="dp-rx-review-med-name">
                  {m.drug} {m.dosage && <span>{m.dosage}</span>}
                </div>
                <div className="dp-rx-review-med-sub">
                  {[m.frequency, m.quantity && `${m.quantity} units`, m.duration].filter(Boolean).join(" · ")}
                </div>
                {m.instructions && <div className="dp-rx-review-med-instr">{m.instructions}</div>}
              </div>
            ))}
          </div>

          {notes && <p style={{ whiteSpace: "pre-wrap" }}>{notes}</p>}
          {labOrders.length > 0 && <div className="dp-med-card"><h3>Attached lab orders</h3>{labOrders.map((o, i) => <p key={i}><strong>{o.test}</strong> · {o.urgency}<br />{o.instructions}</p>)}</div>}
          <p>The patient will see this prescription and its lab orders in their Prescriptions tab after you send it.</p>
          <div className="dp-pharmacy-directives">
            <div className="dp-rx-field" style={{ marginBottom: 10 }}>
              Patient instructions
            </div>
            <label className="dp-directive-row">
              <input type="checkbox" checked={genericSub} onChange={(e) => setGenericSub(e.target.checked)} />
              <CheckCircle2 size={16} className="dp-directive-check" />
              <div>
                <strong>Generic substitution allowed</strong>
                <p>Generic equivalents are allowed where appropriate.</p>
              </div>
            </label>
          </div>

          <div className="dp-modal-actions">
            <button className="dp-btn dp-btn-outline" onClick={() => setStep(3)}>
              Back to Edit
            </button>
            <button className="dp-btn dp-btn-primary" onClick={() => save("finalized")}>
              Finalize Prescription
            </button>
          </div>
        </div>
      )}
    </PageTransition>
  );
}

export function PrescriptionsPage() {
  const [params, setParams] = useSearchParams();
  const prescriptions = useSyncExternalStore(subscribeToPrescriptions, getPrescriptions, getPrescriptions);
  const initialRx = prescriptions.find((r) => r.id === params.get("draft"));
  const [composerOpen, setComposerOpen] = useState(params.get("new") === "1" || (!!initialRx && initialRx.status === "draft"));
  const [editingId, setEditingId] = useState(params.get("draft"));
  const [reviewId, setReviewId] = useState(initialRx && initialRx.status !== "draft" ? initialRx.id : null);
  const [filter, setFilter] = useState("all");
  const draft = prescriptions.find((r) => r.id === editingId);
  const review = prescriptions.find((r) => r.id === reviewId);
  function close() { setComposerOpen(false); setEditingId(null); setParams({}); }
  if (composerOpen && (!draft || draft.status === "draft")) return <PortalLayout><Composer key={editingId || "new"} draft={draft} onClose={close} onIssued={(rx) => { close(); setReviewId(rx.id); }} /></PortalLayout>;
  if (review) return <PortalLayout><PageTransition className="dp-rx-composer">
    <button className="dp-link-btn dp-rx-back" onClick={() => setReviewId(null)}><ChevronLeft size={15} /> Back to Prescriptions</button>
    <div className="dp-panel dp-rx-panel"><h1>{review.status === "sent" ? "Prescription sent to patient" : "Prescription finalized"}</h1><p><strong>{review.patientName}</strong> · {review.rxId}</p><p>{review.diagnosisLabel}</p>
    {review.medications.map((m, i) => <div className="dp-med-card" key={i}><strong>{m.drug} {m.dosage}</strong><p>{[m.frequency, m.duration, m.quantity && m.quantity + " units"].filter(Boolean).join(" · ")}</p><p>{m.instructions}</p></div>)}
    <p style={{ whiteSpace: "pre-wrap" }}>{review.notes}</p>
    {(review.labOrders || []).map((o, i) => <div className="dp-med-card" key={i}><strong>Lab order: {o.test}</strong><p>{o.urgency} · {o.instructions}</p></div>)}
    <p>Sent prescriptions and attached lab orders appear in the patient's Prescriptions tab.</p>
    <div className="dp-modal-actions">{review.status !== "sent" && <><button className="dp-btn dp-btn-outline" onClick={() => { updatePrescription(review.id, { status: "draft" }); setEditingId(review.id); setReviewId(null); setComposerOpen(true); }}>Back to Edit</button><button className="dp-btn dp-btn-primary" onClick={() => { if (sendToPatient(review.id)) addActivity(`Sent prescription ${review.rxId} to ${review.patientName}.`); }}>Send to Patient</button></>}<Link className="dp-btn dp-btn-outline" to="/reports">Finalize Consultation Report</Link></div>
    </div></PageTransition></PortalLayout>;
  return <PortalLayout><PageTransition className="dp-rx-page">
    <div className="dp-rx-heading"><div><h1>Prescriptions</h1><p>Review consultation drafts, finalize prescriptions and lab orders, then send to the patient.</p></div><button className="dp-btn dp-btn-primary" onClick={() => { setEditingId(null); setComposerOpen(true); }}><FileEdit size={15} /> New Prescription</button></div>
    <div className="dp-tabs">{["all", "draft", "finalized", "sent"].map((f) => <button key={f} className={"dp-tab" + (filter === f ? " dp-tab-active" : "")} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</button>)}</div>
    {prescriptions.filter((r) => filter === "all" || r.status === filter).length === 0 ? <p className="dp-empty">No prescriptions in this view. Consultation drafts will appear here.</p> : <div className="dp-rx-table"><div className="dp-rx-table-header"><span>Patient</span><span>Rx ID</span><span>Date</span><span>Orders</span><span>Status</span><span>Patient</span><span>Action</span></div>
    {prescriptions.filter((r) => filter === "all" || r.status === filter).map((rx) => <div className="dp-rx-table-row" key={rx.id}><div><div className="dp-rx-patient-name">{rx.patientName}</div><div className="dp-rx-diagnosis-label">{rx.diagnosisLabel}</div></div><span>{rx.rxId}</span><span>{new Date(rx.issuedAt).toLocaleDateString()}</span><span>{rx.medications.length} medications · {(rx.labOrders || []).length} labs</span><span className={"dp-tag " + (rx.status === "sent" ? "dp-tag-success" : "dp-tag-warning")}>{rx.status === "active" ? "draft" : rx.status}</span><span>{rx.patientStatus === "sent" ? "Sent" : "Not sent"}</span><button className="dp-text-btn" onClick={() => { if (rx.status === "draft" || rx.status === "active") { if (rx.status === "active") updatePrescription(rx.id, { status: "draft" }); setEditingId(rx.id); setComposerOpen(true); } else setReviewId(rx.id); }}>{rx.status === "sent" ? "View" : rx.status === "finalized" ? "Review & Send" : "Review Draft"}</button></div>)}
    </div>}
    <p style={{ marginTop: 20 }}><Link to="/reports">Review consultation report drafts</Link> · <Link to="/patient-prescriptions">Preview patient Prescriptions tab</Link></p>
  </PageTransition></PortalLayout>;
}
export default PrescriptionsPage;

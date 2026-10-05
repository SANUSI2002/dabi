import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Video, Home, User, ChevronLeft, Mic, MicOff, VideoOff, ScreenShare, Settings, Heart, Activity, Thermometer } from "lucide-react";
import { PageTransition } from "design-system";
import PortalLayout from "../../components/PortalLayout";
import { useDoctorAppointments } from "../../hooks/useDoctorAppointments";
import { updateAppointment } from "../../store/doctorAppointmentStore";
import { addDiagnosis } from "../../store/diagnosisStore";
import { addReportDraft, getReports, updateReport } from "../../store/reportStore";
import { addPrescription, getPrescriptions, updatePrescription } from "../../store/prescriptionStore";
import LabOrderFields from "../../components/LabOrderFields";
import { addActivity } from "../../store/activityStore";
import { visitTypeLabel, bookingSourceLabel } from "../../utils/visitType";
import { relativeDayLabel } from "../../utils/dateFormat";
import { patientId } from "../../utils/patientInfo";
import { getDoctorId } from "../../store/doctorSession";
import { readDoctorStorage, writeDoctorStorage } from "../../store/scopedStore";
import PatientRecord from "../../components/PatientRecord";
import { recordPatientId, endRecordAccess } from "../../store/recordAccessStore";
import "./ConsultationsPage.css";

function PreCallScreen({ appt, onBack, onStart }) {

  return (
    <PageTransition className="dp-precall">
      <button className="dp-link-btn dp-precall-back" onClick={onBack}>
        <ChevronLeft size={15} /> Back to Consultations
      </button>

      <div className="dp-precall-card">
        <div className="dp-precall-avatar" style={{ background: appt.color }}>
          {appt.initials}
        </div>
        <h1>{appt.patientName}</h1>
        <div className="dp-precall-meta">
          {appt.patientAge ? `${appt.patientAge} years old` : "Age on file"} · ID: {patientId(appt.patientName, appt.initials)}
        </div>
        <div className="dp-precall-tags">
          <span className="dp-tag dp-tag-neutral">{visitTypeLabel(appt)}</span>
          {bookingSourceLabel(appt) && <span className="dp-tag dp-tag-neutral">{bookingSourceLabel(appt)}</span>}
          <span className="dp-tag dp-tag-neutral">
            {relativeDayLabel(appt.date)} · {appt.startTime}
          </span>
        </div>

        {appt.reason && (
          <div className="dp-precall-reason">
            <div className="dp-precall-reason-label">Reason for visit</div>
            <p>{appt.reason}</p>
          </div>
        )}


        <button className="dp-btn dp-btn-primary dp-precall-join" onClick={onStart}>
          {appt.type === "virtual" ? <Video size={16} /> : <User size={16} />} Join Now
        </button>
      </div>
    </PageTransition>
  );
}

function LiveNotesScreen({ appt, onBack, onEnd }) {
  const ownerId = getDoctorId();
  const draftKey = `sabi-consultation-draft-${appt.id}`;
  const [saved] = useState(() => { try { return JSON.parse(readDoctorStorage(draftKey)) || {}; } catch { return {}; } });
  const [subjective, setSubjective] = useState(typeof saved.subjective === "string" ? saved.subjective : "");
  const [objective, setObjective] = useState(typeof saved.objective === "string" ? saved.objective : "");
  const [assessment, setAssessment] = useState(typeof saved.assessment === "string" ? saved.assessment : "");
  const [diagnosis, setDiagnosis] = useState(typeof saved.diagnosis === "string" ? saved.diagnosis : "");
  const [prescription, setPrescription] = useState(typeof saved.prescription === "string" ? saved.prescription : "");
  const [labOrders, setLabOrders] = useState(Array.isArray(saved.labOrders) ? saved.labOrders.filter((o) => o && typeof o.test === "string").map((o) => ({ instructions: "", urgency: "Routine", ...o })) : []);
  const [saveMessage, setSaveMessage] = useState("");
  useEffect(() => {
    try { writeDoctorStorage(draftKey, JSON.stringify({ subjective, objective, assessment, diagnosis, prescription, labOrders })); } catch { setSaveMessage("Draft storage is unavailable in this browser."); }
    if (![subjective, objective, assessment, diagnosis, prescription].some((v) => v.trim()) && !labOrders.length) return;
    const timer = setTimeout(() => { try { saveDrafts(); } catch { setSaveMessage("Could not save draft. Please retry before leaving."); } }, 400);
    return () => clearTimeout(timer);
  }, [draftKey, subjective, objective, assessment, diagnosis, prescription, labOrders]);
  const [rightTab, setRightTab] = useState("notes");

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [elapsed] = useState("14:24");


  function saveDrafts(dx = null) {
    if (getDoctorId() !== ownerId) throw new Error("Doctor session changed. Reopen the consultation.");
    const reportData = { consultationId: appt.id, patientName: appt.patientName, subjective, objective, diagnosisSummary: [assessment.trim(), diagnosis.trim()].filter(Boolean).join(" — "), treatmentPlan: prescription.trim(), labOrders, status: "draft" };
    const existingReport = getReports().find((r) => r.consultationId === appt.id && r.status === "draft");
    if (existingReport) updateReport(existingReport.id, reportData); else addReportDraft(reportData);
    const existingRx = getPrescriptions().find((r) => r.consultationId === appt.id && r.status === "draft");
    const rxData = { consultationId: appt.id, patientName: appt.patientName, diagnosisId: dx?.id || existingRx?.diagnosisId, diagnosisLabel: dx?.label || diagnosis || assessment, notes: prescription, labOrders, status: "draft" };
    return existingRx ? updatePrescription(existingRx.id, rxData) : addPrescription(rxData);
  }

  function endConsultation() {
    let dx = null;
    if (assessment.trim() || diagnosis.trim()) {
      dx = addDiagnosis({ patientName: appt.patientName, assessment: assessment.trim(), diagnosis: diagnosis.trim(), notes: [subjective, objective].filter(Boolean).join("\n\n"), consultationId: appt.id });
    }
    const rx = saveDrafts(dx);
    updateAppointment(appt.id, { status: "past" });
    addActivity(`Completed consultation with ${appt.patientName}. Prescription and report saved as drafts.`);
    endRecordAccess(appt.id);
    onEnd(rx.id);
  }

  return (
    <PageTransition className="dp-consult-flow">
      <div className="dp-consult-flow-header">
        <h1>Consultation Flow</h1>
        <div className="dp-consult-flow-tabs">
          <span>Upcoming</span>
          <span className="dp-consult-flow-tab-active">In Progress</span>
          <span>Completed</span>
        </div>
        <div className="dp-consult-flow-right">
          <span className="dp-consult-timer">● {elapsed}</span>
          <button className="dp-btn dp-btn-danger" onClick={endConsultation}>
            End & Review Prescription
          </button>
        </div>
      </div>

      <div className="dp-live-layout">
        <div className="dp-live-video">
          <div className="dp-live-video-frame">
            <div className="dp-live-video-tags">
              <span className="dp-live-video-name-tag">
                <User size={12} /> {appt.patientName}
              </span>
              <span className="dp-live-video-quality">▮▮▮ Excellent</span>
            </div>
            {!camOn ? (
              <div className="dp-live-video-off">
                <VideoOff size={32} />
                <p>Camera off</p>
              </div>
            ) : (
              <div className="dp-live-video-placeholder">
                <Video size={40} />
              </div>
            )}
            <div className="dp-live-self-view" />
            <div className="dp-live-controls">
              <button className={`dp-live-control-btn${micOn ? "" : " dp-live-control-btn-off"}`} onClick={() => setMicOn((v) => !v)} aria-label="Toggle microphone">
                {micOn ? <Mic size={16} /> : <MicOff size={16} />}
              </button>
              <button className={`dp-live-control-btn${camOn ? "" : " dp-live-control-btn-off"}`} onClick={() => setCamOn((v) => !v)} aria-label="Toggle camera">
                {camOn ? <Video size={16} /> : <VideoOff size={16} />}
              </button>
              <button className="dp-live-control-btn" aria-label="Share screen">
                <ScreenShare size={16} />
              </button>
              <button className="dp-live-control-btn" aria-label="Settings">
                <Settings size={16} />
              </button>
            </div>
          </div>
          <div className="dp-live-vitals-row" aria-label="Demo vitals">
            <span>
              <Heart size={13} /> Demo: 72 bpm
            </span>
            <span>
              <Activity size={13} /> 118/75
            </span>
            <span>
              <Thermometer size={13} /> 98.6°F
            </span>
          </div>
        </div>

        <div className="dp-live-side">
          <div className="dp-tabs dp-live-side-tabs">
            <button className={`dp-tab${rightTab === "notes" ? " dp-tab-active" : ""}`} onClick={() => setRightTab("notes")}>
              Clinical Notes
            </button>
            <button className={`dp-tab${rightTab === "context" ? " dp-tab-active" : ""}`} onClick={() => setRightTab("context")}>
              Patient Record
            </button>
          </div>

          {rightTab === "notes" ? (
            <div className="dp-clinical-notes dp-clinical-notes-flush">
<p className="dp-live-consult-hint">Use the portal assistant for record summaries. Clinical notes are entered by you.</p>

              <label>
                Subjective / Chief Complaint
                <textarea rows={4} value={subjective} onChange={(e) => setSubjective(e.target.value)} placeholder="Enter patient's reported symptoms..." />
              </label>
              <label>
                Objective Findings
                <textarea rows={3} value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Physical examination notes..." />
              </label>

              {/* Assessment and Diagnosis are two distinct clinical fields — do NOT combine */}
              <label>
                Assessment
                <textarea
                  rows={4}
                  value={assessment}
                  onChange={(e) => setAssessment(e.target.value)}
                  placeholder="Clinician’s assessment of the patient’s condition..."
                />
              </label>
              <label>
                Diagnosis
                <textarea
                  rows={3}
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="Primary diagnosis (e.g. Stage 1 Essential Hypertension)..."
                />
              </label>
              <label>
                Prescription
                <textarea rows={3} value={prescription} onChange={(e) => setPrescription(e.target.value)} placeholder="Medication and treatment instructions to finalize in Prescriptions..." />
              </label>
              <LabOrderFields orders={labOrders} onChange={setLabOrders} />
              <p className="dp-live-consult-hint">Notes are saved automatically. End the consultation to finalize your prescription in Prescriptions and your report in Reports before sending to the patient.</p>
              {saveMessage && <p role="status">{saveMessage}</p>}
              <div className="dp-modal-actions">
                <button className="dp-btn dp-btn-outline" onClick={() => { saveDrafts(); setSaveMessage("Prescription and report drafts saved."); }}>
                  Save Draft
                </button>
              </div>
            </div>
          ) : (
            <PatientRecord scope={{ patientId: recordPatientId(appt), patientName: appt.patientName, consultationId: appt.id }} canRequest />
          )}
        </div>
      </div>
    </PageTransition>
  );
}

export function ConsultationsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const appointments = useDoctorAppointments();
  const [tab, setTab] = useState("upcoming");
  const [activeId, setActiveId] = useState(null);
  const [inCall, setInCall] = useState(false);

  const preselect = searchParams.get("patient");

  const list = useMemo(
    () =>
      appointments
        .filter((a) => a.type !== "blocked" && a.status !== "needs-response" && a.status !== "declined" && a.status !== "cancelled")
        .filter((a) => (tab === "upcoming" ? a.status !== "past" : a.status === "past"))
        .sort((a, b) => (a.date + a.startTime > b.date + b.startTime ? 1 : -1)),
    [appointments, tab]
  );

  const active = appointments.find((a) => a.id === activeId);

  if (active && !inCall) {
    return (
      <PortalLayout topbarProps={{ placeholder: "Search consultations..." }}>
        <PreCallScreen appt={active} onBack={() => setActiveId(null)} onStart={() => setInCall(true)} />
      </PortalLayout>
    );
  }

  if (active && inCall) {
    return (
      <PortalLayout assistantContext={{ patientId: recordPatientId(active), patientName: active.patientName, consultationId: active.id }} topbarProps={{ placeholder: "Search consultations..." }}>
        <LiveNotesScreen
          appt={active}
          onBack={() => {
            setInCall(false);
            setActiveId(null);
          }}
          onEnd={(rxId) => {
            setInCall(false);
            setActiveId(null);
            navigate(`/prescriptions?draft=${rxId}`);
          }}
        />
      </PortalLayout>
    );
  }

  return (
    <PortalLayout topbarProps={{ placeholder: "Search consultations..." }}>
      <PageTransition className="dp-consult-page">
        <h1>Consultations</h1>
        <p className="dp-consult-sub">Your consultation queue — virtual and in-person.</p>

        <div className="dp-tabs">
          <button className={`dp-tab${tab === "upcoming" ? " dp-tab-active" : ""}`} onClick={() => setTab("upcoming")}>
            Upcoming
          </button>
          <button className={`dp-tab${tab === "completed" ? " dp-tab-active" : ""}`} onClick={() => setTab("completed")}>
            Completed
          </button>
        </div>

        <div className="dp-consult-list">
          {list.length === 0 && <p className="dp-empty">Nothing here.</p>}
          {list.map((a) => (
            <button
              key={a.id}
              className={`dp-consult-row dp-consult-row-clickable${preselect === a.patientName ? " dp-consult-row-highlight" : ""}`}
              onClick={() => {
                if (tab === "completed") {
                  const rx = getPrescriptions().find((r) => r.consultationId === a.id);
                  navigate(rx ? `/prescriptions?draft=${rx.id}` : "/reports");
                } else setActiveId(a.id);
              }}
            >
              <div className="dp-consult-row-icon">{a.type === "virtual" ? <Video size={16} /> : <Home size={16} />}</div>
              <div className="dp-consult-row-main">
                <div className="dp-consult-name">{a.patientName}</div>
                <div className="dp-consult-time">
                  {relativeDayLabel(a.date)} · {a.startTime} · {visitTypeLabel(a)}
                </div>
              </div>
              <span className="dp-tag dp-tag-neutral">{tab === "completed" ? "Completed" : "Ready"}</span>
            </button>
          ))}
        </div>
      </PageTransition>
    </PortalLayout>
  );
}

export default ConsultationsPage;

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Filter, Download, MessageSquare, X } from "lucide-react";
import { PageTransition } from "design-system";
import PortalLayout from "../../components/PortalLayout";
import { useDoctorAppointments } from "../../hooks/useDoctorAppointments";
import { fullDateLabel } from "../../utils/dateFormat";
import { patientId } from "../../utils/patientInfo";
import { riskStatusClass } from "../../utils/riskStatus";
import PatientRecord from "../../components/PatientRecord";
import { recordPatientId, accessFor } from "../../store/recordAccessStore";
import "./PatientsPage.css";

const RISK_FILTERS = ["All Patients", "Recent Visits"];

export function PatientsPage() {
  const navigate = useNavigate();
  const appointments = useDoctorAppointments().filter((a) => a.type !== "blocked" && a.status !== "declined");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All Patients");
  const [selected, setSelected] = useState(null);

  const patients = useMemo(() => {
    const byName = new Map();
    for (const a of appointments) {
      if (!byName.has(a.patientName)) {
        byName.set(a.patientName, {
          name: a.patientName,
          age: a.patientAge,
          initials: a.initials,
          color: a.color,
          visits: [],
        });
      }
      byName.get(a.patientName).visits.push(a);
    }
    return [...byName.values()].map((p) => {
      const hasNeedsResponse = appointments.some((a) => a.patientName === p.name && a.status === "needs-response");
      const status = hasNeedsResponse ? "Appointment pending" : "Registered";
      const sorted = [...p.visits].sort((a, b) => (a.date < b.date ? 1 : -1));
      const today = new Date().toISOString().slice(0, 10);
      const past = sorted.filter((v) => v.status === "past" || v.date < today);
      const upcoming = sorted.filter((v) => v.status !== "past" && v.date >= today);
      return { ...p, status, lastVisit: past[0], nextAppt: upcoming[upcoming.length - 1] };
    });
  }, [appointments]);

  const filtered = patients
    .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    .filter((p) => {
      if (filter === "High Risk") return p.status === "Critical" || p.status === "Needs Follow-up";
      if (filter === "Recent Visits") return !!p.lastVisit;
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const activePatient = patients.find((p) => p.name === selected) || filtered[0] || null;
  const recordAppt = activePatient?.visits.find(v => accessFor({patientId:recordPatientId(v),consultationId:v.id})?.status === 'granted') || activePatient?.visits.find(v => !['past','cancelled','declined','needs-response'].includes(v.status));
  const recordScope = activePatient ? { patientName: activePatient.name, patientId: recordAppt ? recordPatientId(recordAppt) : patientId(activePatient.name,activePatient.initials), consultationId: recordAppt?.id } : null;

  return (
    <PortalLayout assistantContext={recordScope} topbarProps={{ placeholder: "Search patients, ID...", onSearch: setQuery }}>
      <PageTransition className="dp-registry">
        <div className="dp-registry-left">
          <div className="dp-registry-header">
            <div>
              <h1>Patients Registry</h1>
              <p>{patients.length} Total Patients</p>
            </div>
            <div className="dp-registry-header-actions">
              <button className="dp-btn dp-btn-outline dp-btn-sm">
                <Filter size={14} /> Filters
              </button>
              <button className="dp-btn dp-btn-outline dp-btn-sm">
                <Download size={14} /> Export
              </button>
            </div>
          </div>

          <div className="dp-registry-filter-pills">
            {RISK_FILTERS.map((f) => (
              <button key={f} className={`dp-pill${filter === f ? " dp-pill-active" : ""}`} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>

          <div className="dp-registry-grid">
            {filtered.length === 0 && <p className="dp-empty">No patients match this view.</p>}
            {filtered.map((p) => (
              <div key={p.name} className={`dp-registry-card${activePatient?.name === p.name ? " dp-registry-card-active" : ""}`}>
                <div className="dp-registry-card-top">
                  <span className="dp-patient-avatar" style={{ background: p.color }}>
                    {p.initials}
                  </span>
                  <div className="dp-registry-card-name-block">
                    <div className="dp-registry-card-name">{p.name}</div>
                    <div className="dp-registry-card-sub">
                      {p.age ? `${p.age}` : "—"} · ID: {patientId(p.name, p.initials)}
                    </div>
                  </div>
                  <span className={`dp-risk-tag ${riskStatusClass(p.status)}`}>{p.status}</span>
                </div>
                <div className="dp-registry-card-dates">
                  <div>
                    <div className="dp-registry-card-date-label">Last Visit</div>
                    <div>{p.lastVisit ? fullDateLabel(p.lastVisit.date) : "—"}</div>
                  </div>
                  <div>
                    <div className="dp-registry-card-date-label">Next Appt</div>
                    <div>{p.nextAppt ? fullDateLabel(p.nextAppt.date) : "None scheduled"}</div>
                  </div>
                </div>
                <div className="dp-registry-card-actions">
                  <button
                    className={`dp-btn dp-btn-sm ${activePatient?.name === p.name ? "dp-btn-primary" : "dp-btn-outline"}`}
                    onClick={() => setSelected(p.name)}
                    style={{ flex: 1 }}
                  >
                    View Record
                  </button>
                  <button className="dp-icon-btn-outline" onClick={() => navigate("/messages")} aria-label="Message patient">
                    <MessageSquare size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dp-registry-right">
          {!activePatient ? (
            <p className="dp-empty">Select a patient to view their record.</p>
          ) : (
            <>
              <div className="dp-registry-detail-header">
                <span className="dp-patient-avatar dp-patient-avatar-lg" style={{ background: activePatient.color }}>
                  {activePatient.initials}
                </span>
                <div className="dp-registry-detail-name-block">
                  <h2>{activePatient.name}</h2>
                  <p>
                    {activePatient.age ? `${activePatient.age}` : "—"} · ID: {patientId(activePatient.name, activePatient.initials)}
                  </p>
                </div>
                <button className="dp-modal-close" onClick={() => setSelected(null)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              <div className="dp-registry-detail-actions">
                <button className="dp-btn dp-btn-primary dp-btn-sm" style={{ flex: 1 }} onClick={() => navigate("/appointments")}>
                  Schedule Follow-up
                </button>
                <button className="dp-btn dp-btn-outline dp-btn-sm" style={{ flex: 1 }} onClick={() => navigate("/messages")}>
                  <MessageSquare size={14} /> Message
                </button>
              </div>

              <PatientRecord key={recordScope?.patientId} scope={recordScope} />
            </>
          )}
        </div>
      </PageTransition>
    </PortalLayout>
  );
}

export default PatientsPage;

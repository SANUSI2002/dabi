import React, { useMemo, useState, useSyncExternalStore } from "react";
import { Info, Clock } from "lucide-react";
import { PageTransition } from "design-system";
import PortalLayout from "../../components/PortalLayout";
import { getQueue, subscribeToQueue, claimPatient } from "../../store/hospitalQueueStore";
import { addActivity } from "../../store/activityStore";
import { DOCTOR_PROFILE } from "../../data/doctorProfile";
import "./HospitalWorkspacePage.css";

const SCHEDULE = [
  { time: "08:30 AM", title: "Ward Round", sub: "Male Medical Ward A" },
  { time: "10:00 AM", title: "Outpatient Clinic", sub: "Consulting Room 4", now: true },
  { time: "12:30 PM", title: "MDT Meeting", sub: "Conference Room B" },
];

export function HospitalWorkspacePage() {
  const queue = useSyncExternalStore(subscribeToQueue, getQueue, getQueue);
  const [tab, setTab] = useState("unassigned");

  const unassigned = useMemo(() => queue.filter((q) => !q.assignedDoctorId), [queue]);
  const mine = useMemo(() => queue.filter((q) => q.assignedDoctorId === DOCTOR_PROFILE.id), [queue]);
  const shown = tab === "unassigned" ? unassigned : mine;

  function handleClaim(q) {
    if (!claimPatient(q.id)) return;
    addActivity(`Claimed patient ${q.patientName} (${q.code}) from the hospital queue.`);
  }

  return (
    <PortalLayout topbarProps={{ placeholder: "Search hospital workspace..." }}>
      <PageTransition className="dp-hw-page">
        <div className="dp-panel dp-hw-header">
          <div>
            <h1>Hospital Workspace</h1>
            <div className="dp-hw-header-sub">
              {DOCTOR_PROFILE.hospital} · {DOCTOR_PROFILE.specialty}
            </div>
          </div>
          <div className="dp-hw-shift">
            <div className="dp-hw-shift-label">CURRENT SHIFT</div>
            <div className="dp-hw-shift-time">08:00 AM – 02:00 PM</div>
          </div>
        </div>

        <div className="dp-hw-layout">
          <div>
            <div className="dp-hw-queue-title-row">
              <h2>Live Hospital Queue</h2>
              <div className="dp-tabs dp-hw-tabs">
                <button className={`dp-tab${tab === "unassigned" ? " dp-tab-active" : ""}`} onClick={() => setTab("unassigned")}>
                  Unassigned ({unassigned.length})
                </button>
                <button className={`dp-tab${tab === "mine" ? " dp-tab-active" : ""}`} onClick={() => setTab("mine")}>
                  My Assigned ({mine.length})
                </button>
              </div>
            </div>

            <div className="dp-hw-queue-list">
              {shown.length === 0 && <p className="dp-empty">Nothing here right now.</p>}
              {shown.map((q) => (
                <div key={q.id} className={`dp-hw-queue-row${q.waitMinutes > 20 ? " dp-hw-queue-row-urgent" : ""}`}>
                  <span className="dp-hw-queue-code">{q.code}</span>
                  <div className="dp-hw-queue-info">
                    <div className="dp-hw-queue-name">{q.patientName}</div>
                    <div className="dp-hw-queue-sub">
                      <Clock size={12} /> {q.waitMinutes} mins wait · {q.reason}
                    </div>
                    <span className="dp-tag dp-tag-neutral">{q.plan}</span>
                  </div>
                  {!q.claimed ? (
                    <button className="dp-btn dp-btn-primary dp-btn-sm" onClick={() => handleClaim(q)}>
                      Claim Patient
                    </button>
                  ) : (
                    <span className="dp-tag dp-tag-success">Claimed</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="dp-panel">
              <h2 className="dp-panel-title-plain">Department Schedule</h2>
              <p className="dp-hw-schedule-sub">Hospital-booked appointments</p>
              <div className="dp-hw-schedule-list">
                {SCHEDULE.map((s) => (
                  <div className={`dp-hw-schedule-row${s.now ? " dp-hw-schedule-row-now" : ""}`} key={s.time}>
                    <div className="dp-hw-schedule-time">{s.time}</div>
                    <div className="dp-hw-schedule-card">
                      <div className="dp-hw-schedule-title-row">
                        <strong>{s.title}</strong>
                        {s.now && <span className="dp-tag dp-tag-success">NOW</span>}
                      </div>
                      <div className="dp-hw-schedule-place">{s.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="dp-panel dp-hw-info-panel">
              <div className="dp-hw-info-title">
                <Info size={15} /> Hospital Information
              </div>
              <div className="dp-hw-info-grid">
                <div>
                  <div className="dp-hw-info-label">Operational Hours</div>
                  <div>24/7 Emergency</div>
                  <div>OPD: 8am – 4pm</div>
                </div>
                <div>
                  <div className="dp-hw-info-label">Your Assigned Days</div>
                  <div>Mon, Wed, Fri</div>
                  <div>Cardiology Clinic</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageTransition>
    </PortalLayout>
  );
}

export default HospitalWorkspacePage;

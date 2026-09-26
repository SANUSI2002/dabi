import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Video, User2, Loader2 } from "lucide-react";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { LoadState } from "../hospitals/hospitalShared";
import { useApiData } from "../../api/useApiData";
import { CONSULTATION_LABELS, getDoctorAppointment, rescheduleDoctorAppointment } from "../../api/doctorsApi";
import { SlotPicker } from "../doctor/components/SlotPicker";

import "../dashboard/Dashboard.css";
import "./Appointments.css";
import "../doctor/Doctor.css";

const when = (iso) => new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Move a booking to another open time with the same doctor. The doctor confirms the new time. */
export function RescheduleAppointment() {
  const [zoom] = useZoom();
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: appointment, error, loading, reload } = useApiData(() => getDoctorAppointment(id), [id]);
  const [slot, setSlot] = useState(null);
  const [type, setType] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (!slot) return setType(null);
    // Keep the original consultation type when the new time offers it.
    setType(appointment && slot.consultationTypes.includes(appointment.consultationType) ? appointment.consultationType : slot.consultationTypes[0]);
  }, [slot, appointment]);

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      setDone(await rescheduleDoctorAppointment(id, { slotId: slot.id, consultationType: type }));
    } catch (err) {
      if (err.code === "SLOT_UNAVAILABLE") {
        setSubmitError("Someone just booked that time. Please choose another.");
        setSlot(null);
        setRefreshKey((k) => k + 1);
      } else if (err.code === "INVALID_STATE") {
        setSubmitError("This appointment can no longer be changed. It may have been cancelled or already started.");
      } else {
        setSubmitError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar placeholder="Search appointments, doctors..." showHelp />

        <button type="button" className="sabi-resched-back" onClick={() => navigate("/appointments")}>
          <ArrowLeft size={16} /> Back to Appointments
        </button>

        <div className="sabi-resched-header">
          <h1>Reschedule Appointment</h1>
          <p>Pick another open time with the same doctor. Your current booking is released and the doctor confirms the new time.</p>
        </div>

        <LoadState loading={loading && !appointment} error={error} onRetry={reload} label="Loading appointment…">
          {appointment && (done ? (
            <div className="sabi-card sabi-resched-done-card">
              <CheckCircle2 size={40} className="sabi-resched-done-icon" />
              <div className="sabi-resched-done-title">New time requested</div>
              <p className="sabi-resched-done-text">
                {done.typeLabel} with {done.doctor.name} on <strong>{when(done.startsAt)}</strong>. It&apos;s awaiting {done.doctor.name}&apos;s confirmation.
              </p>
              <button type="button" className="sabi-btn-primary" onClick={() => navigate("/appointments")}>Back to Appointments</button>
            </div>
          ) : !appointment.canChange ? (
            <div className="sabi-card sabi-live-state">
              <h3>This appointment can&apos;t be rescheduled</h3>
              <p>It is {appointment.statusLabel.toLowerCase()}{appointment.active ? " and has already started" : ""}. Book a new appointment instead.</p>
              <button type="button" className="sabi-btn-primary" onClick={() => navigate("/doctor")}>Find a Doctor</button>
            </div>
          ) : (
            <div className="sabi-grid sabi-resched-grid">
              <div className="sabi-col">
                <div className="sabi-card sabi-resched-current">
                  <div className="sabi-resched-panel-title">Current booking</div>
                  <div className="sabi-resched-current-top">
                    <div className="sabi-apt-avatar">{appointment.initials}</div>
                    <div className="sabi-resched-current-body">
                      <div className="sabi-resched-current-name">{appointment.doctor.name}</div>
                      <div className="sabi-resched-current-sub">{appointment.doctor.specialty} · {appointment.typeLabel}</div>
                      <div className="sabi-resched-current-when">{when(appointment.startsAt)}</div>
                      {appointment.forName && <div className="sabi-resched-current-sub">For {appointment.forName}</div>}
                    </div>
                  </div>
                  <span className={`sabi-status-pill ${appointment.tone}`}>{appointment.statusLabel}</span>
                </div>
              </div>

              <div className="sabi-col">
                <div className="sabi-card sabi-booking-modal sabi-resched-picker">
                  <div className="sabi-resched-panel-title">Choose a new time</div>
                  <SlotPicker doctorId={appointment.doctorProfileId} selectedId={slot?.id} onSelect={setSlot} refreshKey={refreshKey} />
                  {slot && (
                    <div className="sabi-booking-section">
                      <span className="sabi-booking-label">Consultation Type</span>
                      <div className="sabi-booking-type-row">
                        {["IN_PERSON", "VIRTUAL"].map((t) => (
                          <button key={t} type="button" className={type === t ? "active" : ""} disabled={!slot.consultationTypes.includes(t)} onClick={() => setType(t)}>
                            {t === "VIRTUAL" ? <Video size={16} /> : <User2 size={16} />} {CONSULTATION_LABELS[t]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {submitError && <p className="sabi-form-error" role="alert">{submitError}</p>}
                  <div className="sabi-booking-footer">
                    <div>
                      <small>New time</small>
                      <strong>{slot ? when(slot.startsAt) : "—"}</strong>
                    </div>
                    <button type="button" className="sabi-doctor-primary sabi-booking-confirm" disabled={!slot || !type || submitting} onClick={submit}>
                      {submitting ? <><Loader2 size={15} className="sabi-spin" /> Requesting…</> : "Request New Time"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </LoadState>
      </div>
    </div>
  );
}

export default RescheduleAppointment;

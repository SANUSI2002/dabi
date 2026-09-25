import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock3, MapPin, Navigation, Stethoscope, User } from "lucide-react";

import "../../styles/share.css";
import "./Hospitals.css";

import { useApiData } from "../../api/useApiData";
import { checkInHospitalAppointment, getHospital, getHospitalAppointment } from "../../api/sabiApi";
import { LoadState, PageShell, formatDateTime } from "./hospitalShared";

const statusTone = (status) => (status === "SCHEDULED" || status === "CHECKED_IN" ? "good" : status === "PENDING" ? "pending" : "bad");

export function CheckInPage() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const appointment = useApiData(() => getHospitalAppointment(appointmentId), [appointmentId]);
  const hospital = useApiData(
    () => (appointment.data ? getHospital(appointment.data.hospitalId) : Promise.resolve(null)),
    [appointment.data?.hospitalId],
  );
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const a = appointment.data;
  const notFound = appointment.error?.status === 404;

  const handleCheckIn = async () => {
    setBusy(true);
    setActionError("");
    try {
      await checkInHospitalAppointment(appointmentId);
      await appointment.reload();
    } catch (error) {
      setActionError(error.status === 404 ? "This appointment can't be checked in right now — it must be confirmed by the hospital first." : error.message);
    } finally {
      setBusy(false);
    }
  };

  const directionsUrl = hospital.data?.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hospital.data.address)}` : null;

  return (
    <PageShell placeholder="Search appointments...">
      <button className="sabi-rxd-back" onClick={() => navigate("/appointments")}>
        <ArrowLeft size={18} /> Back to Appointments
      </button>

      {notFound ? (
        <div className="sabi-card sabi-live-state">
          <Stethoscope size={32} />
          <h3>We couldn&apos;t find that appointment</h3>
          <button className="sabi-btn-primary" onClick={() => navigate("/appointments")}>Back to Appointments</button>
        </div>
      ) : (
        <LoadState loading={appointment.loading && !a} error={appointment.error} onRetry={appointment.reload} label="Loading appointment…">
          {a && (
            <>
              <header className="sabi-hospitals-wizard-header">
                <div>
                  <h1>Pre-Arrival Check-in</h1>
                  <p>Let {a.hospitalName || "the hospital"} know you&apos;re on your way.</p>
                </div>
              </header>

              <div className="sabi-hospitals-wizard-layout">
                <div className="sabi-hospitals-booking-steps">
                  <div className="sabi-card sabi-hospitals-checkin-ready">
                    <div>
                      <strong>
                        {a.status === "CHECKED_IN" ? "You're checked in" : a.status === "SCHEDULED" ? "Ready for your appointment?" : "Check-in isn't open yet"}
                      </strong>
                      <span>
                        {a.status === "CHECKED_IN"
                          ? `Checked in ${formatDateTime(a.checkedInAt)}. Present yourself at reception on arrival.`
                          : a.status === "SCHEDULED"
                            ? "Checking in tells the hospital you're coming."
                            : a.status === "PENDING"
                              ? "The hospital hasn't confirmed this appointment yet. Check-in opens once it's confirmed."
                              : "This appointment was not confirmed, so it can't be checked in."}
                      </span>
                    </div>
                    <button type="button" className="sabi-btn-primary" disabled={a.status !== "SCHEDULED" || busy} onClick={handleCheckIn}>
                      {a.status === "CHECKED_IN" ? "Checked In" : busy ? "Checking in…" : "Check-in Online"}
                    </button>
                  </div>
                  {actionError && <p className="sabi-form-error" role="alert">{actionError}</p>}

                  {directionsUrl && (
                    <div className="sabi-hospitals-checkin-grid">
                      <div className="sabi-card">
                        <h4><Navigation size={16} /> Directions</h4>
                        <p className="sabi-hospitals-wizard-note">{hospital.data.address}</p>
                        <a className="sabi-btn-outline" href={directionsUrl} target="_blank" rel="noopener noreferrer">Open in Maps</a>
                      </div>
                    </div>
                  )}
                </div>

                <aside className="sabi-hospitals-sidebar">
                  <div className="sabi-card sabi-hospitals-appt-summary">
                    <h4>Appointment Summary</h4>
                    <div className="row"><MapPin size={15} /><div><span>Hospital</span><strong>{a.hospitalName}</strong></div></div>
                    <div className="row"><User size={15} /><div><span>Patient</span><strong>{a.memberName || "You"}</strong></div></div>
                    <div className="row"><Stethoscope size={15} /><div><span>Visit</span><strong>{a.appointmentType}</strong></div></div>
                    <div className="row"><Clock3 size={15} /><div><span>Requested time</span><strong>{formatDateTime(a.requestedAt)}</strong></div></div>
                    <div className="row"><CheckCircle2 size={15} /><div><span>Status</span><strong><span className={`sabi-status-pill ${statusTone(a.status)}`}>{a.statusLabel}</span></strong></div></div>
                  </div>
                </aside>
              </div>
            </>
          )}
        </LoadState>
      )}
    </PageShell>
  );
}

export default CheckInPage;

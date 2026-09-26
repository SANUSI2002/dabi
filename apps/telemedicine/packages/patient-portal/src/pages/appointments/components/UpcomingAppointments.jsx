import React, { useEffect, useState } from "react";
import { Card } from "design-system";
import { Video, MapPin, Clock3, X as XIcon, Info, Loader2 } from "lucide-react";
import { SectionTitle } from "../../dashboard/share";
import { cancelDoctorAppointment, mapsSearchUrl } from "../../../api/doctorsApi";

const day = (iso) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const clock = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

function useEscape(onClose, disabled) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !disabled && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, disabled]);
}

function CancelModal({ appointment, onClose, onCancelled }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEscape(onClose, busy);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await cancelDoctorAppointment(appointment.id, reason);
      await onCancelled();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="sabi-modal-overlay" onClick={() => !busy && onClose()}>
      <div className="sabi-modal" role="dialog" aria-modal="true" aria-label="Cancel appointment" onClick={(e) => e.stopPropagation()}>
        <div className="sabi-modal-head">
          <h3>Cancel this appointment?</h3>
          <button type="button" className="sabi-modal-close" aria-label="Close" onClick={onClose} disabled={busy}><XIcon size={16} /></button>
        </div>
        <p className="sabi-apt-modal-text">
          {appointment.typeLabel} with <strong>{appointment.doctor.name}</strong> on {day(appointment.startsAt)} at {clock(appointment.startsAt)}. The time is released for other patients.
        </p>
        <label className="sabi-booking-label" htmlFor="cancel-reason">Reason for the doctor (optional)</label>
        <textarea id="cancel-reason" className="sabi-booking-reason" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        {error && <p className="sabi-form-error" role="alert">{error}</p>}
        <div className="sabi-apt-modal-actions">
          <button type="button" className="sabi-apt-secondary-btn" onClick={onClose} disabled={busy}>Keep Appointment</button>
          <button type="button" className="sabi-apt-danger-btn" onClick={confirm} disabled={busy}>
            {busy ? <Loader2 size={15} className="sabi-spin" /> : null} Cancel Appointment
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppointmentDetailModal({ appointment, onClose }) {
  useEscape(onClose, false);
  return (
    <div className="sabi-modal-overlay" onClick={onClose}>
      <div className="sabi-modal" role="dialog" aria-modal="true" aria-label="Appointment details" onClick={(e) => e.stopPropagation()}>
        <div className="sabi-modal-head">
          <h3>Appointment Details</h3>
          <button type="button" className="sabi-modal-close" aria-label="Close" onClick={onClose}><XIcon size={16} /></button>
        </div>
        <div className="sabi-apt-detail-head">
          <div className="sabi-apt-avatar">{appointment.initials}</div>
          <div>
            <div className="sabi-resched-current-name">{appointment.doctor.name}</div>
            <div className="sabi-resched-current-sub">{appointment.doctor.specialty}</div>
          </div>
          <span className={`sabi-status-pill ${appointment.tone}`}>{appointment.statusLabel}</span>
        </div>
        <dl className="sabi-apt-detail-list">
          <div><dt>When</dt><dd>{day(appointment.startsAt)}, {clock(appointment.startsAt)} – {clock(appointment.endsAt)}</dd></div>
          <div><dt>Type</dt><dd>{appointment.typeLabel}</dd></div>
          {appointment.forName && <div><dt>For</dt><dd>{appointment.forName}</dd></div>}
          {appointment.consultationType === "IN_PERSON" && appointment.doctor.practiceAddress && (
            <div><dt>Where</dt><dd><a href={mapsSearchUrl(appointment.doctor.practiceAddress)} target="_blank" rel="noopener noreferrer">{[appointment.doctor.practiceName, appointment.doctor.practiceAddress].filter(Boolean).join(", ")}</a></dd></div>
          )}
          {appointment.reason && <div><dt>Your note</dt><dd>{appointment.reason}</dd></div>}
          {appointment.decisionReason && <div><dt>{appointment.status === "DECLINED" ? "Doctor's reason" : "Reason"}</dt><dd>{appointment.decisionReason}</dd></div>}
          {appointment.canJoin && <div><dt>Video link</dt><dd><a href={appointment.meetingUrl} target="_blank" rel="noopener noreferrer">{appointment.meetingUrl}</a></dd></div>}
        </dl>
      </div>
    </div>
  );
}

/** Doctor bookings from the Sabi API, with actions that match each booking's real status. */
export function UpcomingAppointments({ title, appointments, loading, error, onRetry, onViewAll, onReschedule, onChanged }) {
  const [details, setDetails] = useState(null);
  const [cancelling, setCancelling] = useState(null);

  return (
    <Card>
      <SectionTitle action={onViewAll ? "View All" : undefined} onAction={onViewAll}>{title}</SectionTitle>

      {error ? (
        <p className="sabi-modal-empty" role="alert">{error.message} <button type="button" className="sabi-apt-secondary-btn" onClick={onRetry}>Retry</button></p>
      ) : loading ? (
        <p className="sabi-modal-empty">Loading your appointments…</p>
      ) : appointments.length === 0 ? (
        <p className="sabi-modal-empty">No appointments here. Book with a verified doctor from <strong>Find a Doctor</strong>.</p>
      ) : (
        <div className="sabi-apt-list">
          {appointments.map((apt) => (
            <div className={`sabi-apt-item${apt.status === "REQUESTED" ? " sabi-apt-item-pending" : ""}${apt.tone === "bad" ? " sabi-apt-item-declined" : ""}`} key={apt.id}>
              <div className="sabi-apt-item-top">
                <div className="sabi-apt-avatar">{apt.initials}</div>
                <div className="sabi-apt-item-body">
                  <div className="sabi-apt-item-name">{apt.doctor.name}</div>
                  <div className="sabi-apt-item-sub">{apt.doctor.specialty} · {apt.typeLabel}</div>
                  {apt.forName && <div className="sabi-apt-item-location">For {apt.forName}</div>}
                </div>
                <div className="sabi-apt-item-when">
                  <div className="sabi-apt-item-date">{day(apt.startsAt)}</div>
                  <div className="sabi-apt-item-time">{clock(apt.startsAt)}</div>
                </div>
              </div>

              <div className="sabi-apt-item-status">
                <span className={`sabi-status-pill ${apt.tone}`}>{apt.statusLabel}</span>
                {apt.status === "REQUESTED" && <span className="sabi-apt-status-note"><Clock3 size={13} /> The time is held while the doctor reviews it</span>}
                {apt.status === "CONFIRMED" && apt.consultationType === "VIRTUAL" && !apt.meetingUrl && apt.upcoming && (
                  <span className="sabi-apt-status-note"><Info size={13} /> The doctor will add the video link</span>
                )}
              </div>
              {apt.decisionReason && apt.tone === "bad" && <div className="sabi-apt-declined-note"><XIcon size={14} /> {apt.decisionReason}</div>}

              <div className="sabi-apt-item-actions">
                {apt.canJoin && (
                  <a className="sabi-apt-join-btn" href={apt.meetingUrl} target="_blank" rel="noopener noreferrer">
                    <Video size={15} /> Join Video Consultation
                  </a>
                )}
                {apt.upcoming && apt.consultationType === "IN_PERSON" && apt.doctor.practiceAddress && (
                  <a className="sabi-apt-checkin-btn" href={mapsSearchUrl(apt.doctor.practiceAddress)} target="_blank" rel="noopener noreferrer">
                    <MapPin size={15} /> Directions
                  </a>
                )}
                <button type="button" className="sabi-apt-view-btn" onClick={() => setDetails(apt)}>View Details</button>
                {apt.canChange && (
                  <>
                    <button type="button" className="sabi-apt-secondary-btn" onClick={() => onReschedule(apt)}>Reschedule</button>
                    <button type="button" className="sabi-apt-secondary-btn" onClick={() => setCancelling(apt)}>Cancel</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {details && <AppointmentDetailModal appointment={details} onClose={() => setDetails(null)} />}
      {cancelling && (
        <CancelModal
          appointment={cancelling}
          onClose={() => setCancelling(null)}
          onCancelled={async () => {
            setCancelling(null);
            await onChanged();
          }}
        />
      )}
    </Card>
  );
}

export default UpcomingAppointments;

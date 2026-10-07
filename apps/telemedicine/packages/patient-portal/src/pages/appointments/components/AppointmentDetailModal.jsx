import React from "react";
import { X, MapPin, CalendarClock, Clock3 } from "lucide-react";
import { mapsSearchUrl } from "../../../api/doctorsApi";

// Directions use the practice address (doctors publish an address, not coordinates).
const openDirections = (appointment) => appointment.address && window.open(mapsSearchUrl(appointment.address), "_blank", "noopener,noreferrer");
const longDate = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

// The visit summary your doctor signed after the consultation (their private clinical notes are never shared).
function VisitSummary({ visit }) {
  const { summary } = visit;
  const sections = [["What we discussed", summary.summary], ["Advice and next steps", summary.advice], ["When to seek urgent care", summary.warningSigns]].filter(([, text]) => text);
  return (
    <section aria-label="Visit summary">
      <div className="sabi-apt-request-detail">
        <span>Visit summary</span>
        <p>From {visit.doctor.name || "your doctor"} · {visit.updated ? `updated ${longDate(visit.signedAt)}` : longDate(visit.signedAt)}</p>
      </div>
      {sections.map(([title, text]) => (
        <div className="sabi-apt-request-detail" key={title}>
          <span>{title}</span>
          <p style={{ whiteSpace: "pre-wrap" }}>{text}</p>
        </div>
      ))}
      {summary.followUp.needed && (
        <div className="sabi-apt-request-detail">
          <span>Follow-up</span>
          <p style={{ whiteSpace: "pre-wrap" }}>{[summary.followUp.timeframe, summary.followUp.instructions].filter(Boolean).join(" — ")}</p>
        </div>
      )}
    </section>
  );
}

export function AppointmentDetailModal({ appointment, onClose }) {
  const pendingReview = appointment.status === "pending-review";

  return (
    <div className="sabi-modal-overlay" onClick={onClose}>
      <div className="sabi-modal" role="dialog" aria-modal="true" aria-label="Appointment details" onClick={(e) => e.stopPropagation()}>
        <div className="sabi-modal-head">
          <h3>{pendingReview ? "Advance Booking Request" : "Appointment Details"}</h3>
          <button type="button" className="sabi-modal-close" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="sabi-apt-avatar" style={{ background: appointment.color, marginBottom: 12 }}>
          {appointment.initials}
        </div>
        <div className="sabi-resched-current-name" style={{ marginBottom: 4 }}>{appointment.doctor}</div>
        <div className="sabi-resched-current-sub" style={{ marginBottom: 10 }}>{appointment.specialty}</div>

        {pendingReview && (
          <div className="sabi-apt-pending-note" style={{ marginBottom: 12 }}>
            <Clock3 size={14} /> {appointment.rescheduleNote || "Pending Review — you'll be notified once it's confirmed"}
          </div>
        )}

        <div className="sabi-emcard-box" style={{ marginBottom: 8 }}>
          {/* DEBUG NOTE: Connected location click handler to trigger directions. */}
          <button type="button" className="sabi-emcard-contact" onClick={() => openDirections(appointment)}><MapPin size={14} /> {appointment.location}</button>
          <div className="sabi-emcard-contact"><CalendarClock size={14} /> {appointment.date} · {appointment.time}</div>
        </div>

        {pendingReview && appointment.reason && (
          <div className="sabi-apt-request-detail">
            <span>Description of Medical Concern</span>
            <p>{appointment.reason}</p>
          </div>
        )}

        {appointment.visitSummary && <VisitSummary visit={appointment.visitSummary} />}
        {appointment.visitSummaryUnavailable && (
          <div className="sabi-apt-pending-note" role="status">
            <Clock3 size={14} /> We couldn't load your visit summary. Reopen Appointments to try again.
          </div>
        )}

        {pendingReview && appointment.notes && (
          <div className="sabi-apt-request-detail">
            <span>Additional Notes</span>
            <p>{appointment.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AppointmentDetailModal;

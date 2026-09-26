import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, MapPin, Video, User2, Clock3, Users, Loader2 } from "lucide-react";
import { SlotPicker } from "./SlotPicker";
import { useCareSubjects } from "../../hospitals/hospitalShared";
import { bookDoctor, CONSULTATION_LABELS, formatNaira } from "../../../api/doctorsApi";

/**
 * Book one of a doctor's real open slots. The booking starts as a request; the doctor confirms it.
 * `preselectDependentId` comes from the Family pages ("book for …").
 */
export function BookingModal({ doctor, preselectDependentId, onClose }) {
  const navigate = useNavigate();
  const { subjects } = useCareSubjects();
  const [subjectKey, setSubjectKey] = useState(preselectDependentId || "self");
  const [slot, setSlot] = useState(null);
  const [type, setType] = useState(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [booked, setBooked] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !submitting && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  // Each slot lists the consultation types the doctor offers at that time.
  useEffect(() => {
    if (!slot) return setType(null);
    setType((current) => (slot.consultationTypes.includes(current) ? current : slot.consultationTypes[0]));
  }, [slot]);

  const subject = subjects.find((s) => s.key === subjectKey) || subjects[0];
  const forOther = subject && subject.key !== "self";

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      setBooked(await bookDoctor({ slotId: slot.id, consultationType: type, reason, dependentId: subject?.dependentId }));
    } catch (err) {
      if (err.code === "SLOT_UNAVAILABLE") {
        setError("Someone just booked that time. Please choose another.");
        setSlot(null);
        setRefreshKey((k) => k + 1);
      } else {
        setError(err.errors?.map((e) => e.message).join(" ") || err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sabi-modal-overlay" onClick={() => !submitting && onClose()}>
      <div className="sabi-modal sabi-modal-lg sabi-booking-modal" role="dialog" aria-modal="true" aria-label={`Book ${doctor.name}`} onClick={(e) => e.stopPropagation()}>
        <div className="sabi-modal-head">
          <h3>{booked ? "Request Sent" : "Book an Appointment"}</h3>
          <button type="button" className="sabi-modal-close" aria-label="Close" onClick={onClose} disabled={submitting}>
            <X size={16} />
          </button>
        </div>

        {booked ? (
          <div className="sabi-booking-success">
            <div className="sabi-booking-success-icon sabi-booking-success-icon-pending">
              <Clock3 size={38} />
            </div>
            <h4>Request sent to {doctor.name}</h4>
            <p>
              {booked.typeLabel}
              {booked.forName ? ` for ${booked.forName}` : ""} on{" "}
              <strong>{new Date(booked.startsAt).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</strong>.
            </p>
            <p className="sabi-booking-success-note">
              The time is held for you while {doctor.name} reviews it. You&apos;ll see it change to <strong>Confirmed</strong>
              {booked.consultationType === "VIRTUAL" ? " — with the video link —" : ""} in My Appointments.
            </p>
            <div className="sabi-booking-success-actions">
              <button type="button" className="sabi-doctor-outline" onClick={onClose}>Done</button>
              <button type="button" className="sabi-doctor-primary sabi-booking-done" onClick={() => navigate("/appointments")}>View My Appointments</button>
            </div>
          </div>
        ) : (
          <>
            <div className="sabi-booking-doctor">
              <span className="sabi-doctor-avatar" aria-hidden="true">{doctor.initials}</span>
              <div>
                <strong>{doctor.name}</strong>
                <span>
                  {doctor.specialty}
                  {doctor.yearsOfExperience != null ? ` · ${doctor.yearsOfExperience}+ yrs experience` : ""}
                </span>
                {(doctor.practiceName || doctor.practiceAddress) && (
                  <span className="sabi-booking-doctor-clinic"><MapPin size={13} /> {[doctor.practiceName, doctor.practiceAddress].filter(Boolean).join(", ")}</span>
                )}
              </div>
            </div>

            {subjects.length > 1 && (
              <div className="sabi-booking-section">
                <span className="sabi-booking-label"><Users size={14} /> Who is this for?</span>
                <div className="sabi-subject-picker">
                  {subjects.map((s) => (
                    <button key={s.key} type="button" className={s.key === subject?.key ? "active" : ""} aria-pressed={s.key === subject?.key} onClick={() => setSubjectKey(s.key)}>
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {forOther && (
              <div className="sabi-booking-for-note">
                <Users size={14} /> Booking for <strong>{subject.name}</strong>
              </div>
            )}

            <SlotPicker doctorId={doctor.id} selectedId={slot?.id} onSelect={setSlot} refreshKey={refreshKey} />

            {slot && (
              <div className="sabi-booking-section">
                <span className="sabi-booking-label">Consultation Type</span>
                <div className="sabi-booking-type-row">
                  {["IN_PERSON", "VIRTUAL"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={type === t ? "active" : ""}
                      disabled={!slot.consultationTypes.includes(t)}
                      title={slot.consultationTypes.includes(t) ? undefined : "Not offered at this time"}
                      onClick={() => setType(t)}
                    >
                      {t === "VIRTUAL" ? <Video size={16} /> : <User2 size={16} />} {CONSULTATION_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="sabi-booking-section">
              <label className="sabi-booking-label" htmlFor="booking-reason">What would you like to discuss? (optional)</label>
              <textarea
                id="booking-reason"
                className="sabi-booking-reason"
                rows={2}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Follow-up on blood pressure readings"
              />
              <small className="sabi-booking-hint">Shared only with {doctor.name}.</small>
            </div>

            {error && <p className="sabi-form-error" role="alert">{error}</p>}

            <div className="sabi-booking-footer">
              <div>
                <small>Consultation Fee</small>
                <strong>{doctor.fee != null ? formatNaira(doctor.fee) : "Ask the practice"}</strong>
              </div>
              <button type="button" className="sabi-doctor-primary sabi-booking-confirm" disabled={!slot || !type || submitting} onClick={submit}>
                {submitting ? <><Loader2 size={15} className="sabi-spin" /> Sending…</> : "Request Appointment"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default BookingModal;

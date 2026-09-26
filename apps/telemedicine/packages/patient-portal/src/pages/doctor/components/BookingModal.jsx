import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, CalendarPlus, Check, CheckCircle2, Clock3, MapPin, Plus, User2, Users, Video, X } from "lucide-react";
import { bookDoctor, listDoctorSlots } from "../../../api/doctorsApi";

// yyyy-mm-dd in the patient's own time zone.
const localKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const timeLabel = (iso) => new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
const TYPE_VALUE = { "in-person": "IN_PERSON", virtual: "VIRTUAL" };

function nextDays(count = 5) {
  const days = [];
  const today = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      key: localKey(d),
      weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
      day: d.getDate(),
    });
  }
  return days;
}

// The doctor only publishes availability for the next 6 days (per the
// scheduling PRD), so "Book in Advance" requests must start the day after
// that window closes.
function minAdvanceDate(days) {
  const last = days[days.length - 1];
  const d = last ? new Date(`${last.key}T00:00:00`) : new Date();
  d.setDate(d.getDate() + 1);
  return localKey(d);
}

export function BookingModal({ doctor, bookingFor, onClose, onBooked }) {
  const [mode, setMode] = useState("standard"); // "standard" | "advance"
  const offered = doctor?.consultationTypes || [];
  const [type, setType] = useState(offered.includes("IN_PERSON") || !offered.length ? "in-person" : "virtual");

  // Standard booking: the next 6 days of the doctor's published times.
  const days = useMemo(() => nextDays(6), []);
  const [date, setDate] = useState(days[0]?.key);
  const [time, setTime] = useState(null); // selected slot id
  const [openSlots, setOpenSlots] = useState(null);
  const [slotsError, setSlotsError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Book in Advance: a later date, chosen from the doctor's published times on that date.
  const advanceMin = useMemo(() => minAdvanceDate(days), [days]);
  const [advanceDate, setAdvanceDate] = useState(advanceMin);
  const [advanceTime, setAdvanceTime] = useState("");
  const [advanceSlots, setAdvanceSlots] = useState(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const [result, setResult] = useState(null); // "requested"
  const [booked, setBooked] = useState(null); // { date, time }
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!doctor) return undefined;
    let live = true;
    listDoctorSlots(doctor.id).then(
      (items) => {
        if (!live) return;
        setOpenSlots(items);
        setSlotsError(null);
        // Start on the first day that has open times.
        const openKeys = new Set(items.map((slot) => localKey(new Date(slot.startsAt))));
        setDate((current) => (openKeys.has(current) ? current : days.find((d) => openKeys.has(d.key))?.key ?? current));
      },
      (err) => { if (live) setSlotsError(err.message); },
    );
    return () => { live = false; };
  }, [doctor, refreshKey]);

  useEffect(() => {
    if (!doctor || mode !== "advance" || !advanceDate) return undefined;
    let live = true;
    setAdvanceSlots(null);
    listDoctorSlots(doctor.id, new Date(`${advanceDate}T00:00:00`)).then(
      (items) => { if (live) setAdvanceSlots(items.filter((slot) => localKey(new Date(slot.startsAt)) === advanceDate)); },
      (err) => { if (live) setSlotsError(err.message); },
    );
    return () => { live = false; };
  }, [doctor, mode, advanceDate, refreshKey]);

  if (!doctor) return null;

  const typeValue = TYPE_VALUE[type];
  const offers = (slot) => slot.consultationTypes.includes(typeValue);
  const openDayKeys = new Set((openSlots || []).filter(offers).map((slot) => localKey(new Date(slot.startsAt))));
  const slots = (openSlots || [])
    .filter((slot) => offers(slot) && localKey(new Date(slot.startsAt)) === date)
    .map((slot) => ({ id: slot.id, label: timeLabel(slot.startsAt), startsAt: slot.startsAt }));
  const advanceOptions = (advanceSlots || []).filter(offers);
  const selectedDay = days.find((d) => d.key === date);

  // In-person visits happen at the doctor's practice.
  const needsAddress = type === "in-person" && Boolean(doctor.practiceAddress);
  const canSubmitStandard = Boolean(time);
  const canSubmitAdvance = Boolean(advanceDate) && Boolean(advanceTime) && reason.trim().length > 0;

  const book = async (slotId, note) => {
    setSubmitting(true);
    setError(null);
    try {
      const appointment = await bookDoctor({
        slotId,
        consultationType: typeValue,
        reason: note,
        dependentId: bookingFor && !bookingFor.isSelf && bookingFor.isDependent !== false ? bookingFor.id : undefined,
      });
      const at = new Date(appointment.startsAt);
      setBooked({ date: at.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric" }), time: timeLabel(appointment.startsAt) });
      setResult("requested");
      onBooked?.(doctor);
    } catch (err) {
      if (err.code === "SLOT_UNAVAILABLE") {
        setError("Someone just booked that time. Please choose another.");
        setTime(null);
        setAdvanceTime("");
        setRefreshKey((k) => k + 1);
      } else {
        setError(err.errors?.map((e) => e.message).join(" ") || err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmStandard = () => {
    if (!canSubmitStandard) return;
    book(time);
  };

  const handleSubmitAdvanceRequest = () => {
    if (!canSubmitAdvance) return;
    const note = [reason.trim(), notes.trim()].filter(Boolean).join(" — ").slice(0, 500);
    book(advanceTime, note);
  };

  const advanceDateLabel = booked?.date || "";

  const isForOther = bookingFor && !bookingFor.isSelf;
  const awaitingAcceptance = isForOther && bookingFor.isDependent === false;

  const AddressStep = (
    <div className="sabi-booking-section">
      <span className="sabi-booking-label"><MapPin size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} /> Visit Address</span>
      <p className="sabi-booking-advance-note" style={{ marginTop: 0, marginBottom: 10 }}>
        In-person visits take place at {doctor.name}'s practice.
      </p>
      <div className="sabi-booking-address-grid">
        <button type="button" className="sabi-booking-address-card selected">
          <span className="check"><Check size={14} /></span>
          <strong>{doctor.practiceName || "Practice"}</strong>
          <span>{doctor.practiceAddress}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="sabi-modal-overlay" onClick={onClose}>
      <div
        className="sabi-modal sabi-modal-lg sabi-booking-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Book appointment with ${doctor.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sabi-modal-head">
          <h3>
            {result === "confirmed"
              ? "Appointment Confirmed"
              : result === "requested"
              ? "Request Sent"
              : "Schedule a Visit"}
          </h3>
          <button type="button" className="sabi-modal-close" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {result === "confirmed" && (
          <div className="sabi-booking-success">
            <div className={`sabi-booking-success-icon ${awaitingAcceptance ? "sabi-booking-success-icon-pending" : ""}`}>
              {awaitingAcceptance ? <Clock3 size={38} /> : <CheckCircle2 size={40} />}
            </div>
            <h4>
              {awaitingAcceptance
                ? `Reservation sent to ${bookingFor.name}`
                : isForOther
                ? `${bookingFor.name} is booked with ${doctor.name}`
                : `You're booked with ${doctor.name}`}
            </h4>
            <p>
              {type === "in-person" ? "In-person" : "Virtual"} consultation on{" "}
              <strong>{selectedDay?.weekday} {selectedDay?.day}</strong> at <strong>{time}</strong>.
            </p>
            <p className="sabi-booking-success-note">
              {awaitingAcceptance
                ? `${bookingFor.name} manages their own account, so they'll see this on their calendar and need to accept it before it's confirmed.`
                : isForOther
                ? `This is on ${bookingFor.name}'s calendar automatically since you manage their account.`
                : "A confirmation has been added to your Appointments. You can reschedule or cancel any time before the visit."}
            </p>
            <button type="button" className="sabi-doctor-primary sabi-booking-done" onClick={onClose}>
              Done
            </button>
          </div>
        )}

        {result === "requested" && (
          <div className="sabi-booking-success">
            <div className="sabi-booking-success-icon sabi-booking-success-icon-pending">
              <Clock3 size={38} />
            </div>
            <h4>Request sent to {doctor.name}</h4>
            <p>
              You requested {type === "in-person" ? "an in-person" : "a virtual"} consultation on{" "}
              <strong>{advanceDateLabel}</strong> at <strong>{booked?.time}</strong>.
            </p>
            <p className="sabi-booking-success-note">
              This appointment is now <strong>Pending Doctor Review</strong>. {doctor.name} will accept, decline, or
              suggest another time — you'll see the update in My Appointments.
            </p>
            <button type="button" className="sabi-doctor-primary sabi-booking-done" onClick={onClose}>
              Done
            </button>
          </div>
        )}

        {!result && (
          <>
            <div className="sabi-booking-doctor">
              {doctor.photo ? <img src={doctor.photo} alt={doctor.name} /> : <div className="sabi-doctor-photo-initials sabi-booking-initials" aria-hidden="true">{doctor.initials}</div>}
              <div>
                <strong>{doctor.name}</strong>
                <span>{doctor.specialty}{doctor.experience != null ? ` · ${doctor.experience}+ yrs experience` : ""}</span>
                <span className="sabi-booking-doctor-clinic"><MapPin size={13} /> {doctor.clinic}</span>
              </div>
            </div>

            {isForOther && (
              <div className="sabi-booking-for-note">
                <Users size={14} /> Booking for <strong>{bookingFor.name}</strong>
              </div>
            )}

            <div className="sabi-booking-mode-row">
              <button
                type="button"
                className={mode === "standard" ? "active" : ""}
                onClick={() => setMode("standard")}
              >
                <CalendarDays size={16} /> Standard Booking
              </button>
              <button
                type="button"
                className={mode === "advance" ? "active" : ""}
                onClick={() => setMode("advance")}
              >
                <CalendarPlus size={16} /> Book in Advance
              </button>
            </div>

            <div className="sabi-booking-section">
              <span className="sabi-booking-label">Consultation Type</span>
              <div className="sabi-booking-type-row">
                <button
                  type="button"
                  className={type === "in-person" ? "active" : ""}
                  disabled={offered.length > 0 && !offered.includes("IN_PERSON")}
                  onClick={() => { setType("in-person"); setTime(null); setAdvanceTime(""); }}
                >
                  <User2 size={16} /> In-Person
                </button>
                <button
                  type="button"
                  className={type === "virtual" ? "active" : ""}
                  disabled={offered.length > 0 && !offered.includes("VIRTUAL")}
                  onClick={() => { setType("virtual"); setTime(null); setAdvanceTime(""); }}
                >
                  <Video size={16} /> Virtual
                </button>
              </div>
            </div>

            {needsAddress && AddressStep}

            {mode === "standard" ? (
              <>
                <div className="sabi-booking-section">
                  <span className="sabi-booking-label"><CalendarDays size={14} /> Availability</span>
                  <div className="sabi-booking-days">
                    {days.map((d) => (
                      <button
                        key={d.key}
                        type="button"
                        className={date === d.key ? "active" : ""}
                        disabled={openSlots !== null && !openDayKeys.has(d.key)}
                        onClick={() => { setDate(d.key); setTime(null); }}
                      >
                        <small>{d.weekday}</small>
                        <strong>{d.day}</strong>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sabi-booking-section">
                  <span className="sabi-booking-label">Available Slots</span>
                  <div className="sabi-booking-slots">
                    {slots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        className={time === slot.id ? "active" : ""}
                        onClick={() => setTime(slot.id)}
                      >
                        {slot.label}
                      </button>
                    ))}
                    {slotsError && <p className="sabi-booking-advance-note">{slotsError}</p>}
                    {!slotsError && openSlots === null && <p className="sabi-booking-advance-note">Loading open times…</p>}
                    {!slotsError && openSlots !== null && !slots.length && (
                      <p className="sabi-booking-advance-note">No open times this day. Pick another day or use Book in Advance.</p>
                    )}
                  </div>
                </div>

                {error && <p className="sabi-form-error" role="alert">{error}</p>}
                <div className="sabi-booking-footer">
                  <div>
                    <small>Consultation Fee</small>
                    <strong>{doctor.fee != null ? `₦${doctor.fee.toLocaleString()}` : "—"}</strong>
                  </div>
                  <button
                    type="button"
                    className="sabi-doctor-primary sabi-booking-confirm"
                    disabled={!canSubmitStandard || submitting}
                    onClick={handleConfirmStandard}
                  >
                    {submitting ? "Sending…" : "Request Appointment"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="sabi-booking-advance-note">
                  {doctor.name.split(" ").slice(-1)[0]}'s schedule is only open through{" "}
                  <strong>{days[days.length - 1]?.weekday} {days[days.length - 1]?.day}</strong>. Request a date
                  beyond that and {doctor.name} will review and respond.
                </p>

                <div className="sabi-booking-section sabi-booking-advance-grid">
                  <label className="sabi-booking-field">
                    <span className="sabi-booking-label">Preferred Date</span>
                    <input
                      type="date"
                      min={advanceMin}
                      value={advanceDate}
                      onChange={(e) => { setAdvanceDate(e.target.value); setAdvanceTime(""); }}
                    />
                  </label>
                  <label className="sabi-booking-field">
                    <span className="sabi-booking-label">Preferred Time</span>
                    <select value={advanceTime} onChange={(e) => setAdvanceTime(e.target.value)} disabled={!advanceSlots || !advanceOptions.length}>
                      <option value="">{!advanceSlots ? "Loading…" : advanceOptions.length ? "Choose a time" : "No open times that day"}</option>
                      {advanceOptions.map((slot) => (
                        <option key={slot.id} value={slot.id}>{timeLabel(slot.startsAt)}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="sabi-booking-section">
                  <label className="sabi-booking-field">
                    <span className="sabi-booking-label">Description of Medical Concern</span>
                    <textarea
                      rows={3}
                      placeholder="e.g. Follow-up consultation regarding my previous treatment…"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                </div>

                <div className="sabi-booking-section">
                  <label className="sabi-booking-field">
                    <span className="sabi-booking-label">Additional Notes (Optional)</span>
                    <textarea
                      rows={2}
                      placeholder="Anything else the doctor should know…"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </label>
                </div>

                {error && <p className="sabi-form-error" role="alert">{error}</p>}
                <div className="sabi-booking-footer">
                  <div>
                    <small>Consultation Fee</small>
                    <strong>{doctor.fee != null ? `₦${doctor.fee.toLocaleString()}` : "—"}</strong>
                  </div>
                  <button
                    type="button"
                    className="sabi-doctor-primary sabi-booking-confirm"
                    disabled={!canSubmitAdvance || submitting}
                    onClick={handleSubmitAdvanceRequest}
                  >
                    {submitting ? "Sending…" : "Send Request to Doctor"}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default BookingModal;

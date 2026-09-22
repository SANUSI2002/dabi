import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, CalendarPlus, Check, CheckCircle2, Clock3, MapPin, Plus, User2, Users, Video, X } from "lucide-react";
import { getAddresses, addAddress } from "../../pharmacy-market/cartStore";

function nextDays(count = 5) {
  const days = [];
  const today = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      key: d.toISOString().slice(0, 10),
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
  return d.toISOString().slice(0, 10);
}

export function BookingModal({ doctor, bookingFor, onClose, onConfirmed, onRequestSubmitted }) {
  const [mode, setMode] = useState("standard"); // "standard" | "advance"
  const [type, setType] = useState("in-person");

  // Standard booking state
  const days = useMemo(() => nextDays(6), []);
  const [date, setDate] = useState(days[0]?.key);
  const [time, setTime] = useState(null);

  // Book in Advance state
  const advanceMin = useMemo(() => minAdvanceDate(days), [days]);
  const [advanceDate, setAdvanceDate] = useState(advanceMin);
  const [advanceTime, setAdvanceTime] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  // Address (in-person visits only — the doctor comes to this address)
  const [addresses, setAddresses] = useState(getAddresses);
  const [selectedAddressId, setSelectedAddressId] = useState(() => addresses.find((a) => a.isDefault)?.id || addresses[0]?.id || null);
  const [showAddressForm, setShowAddressForm] = useState(addresses.length === 0);
  const [newAddress, setNewAddress] = useState({ label: "", recipient: "", phone: "", address: "" });

  const [result, setResult] = useState(null); // "confirmed" | "requested"
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!doctor) return null;

  const slots = doctor.slots?.length ? doctor.slots : ["09:00 AM", "10:30 AM", "01:15 PM", "03:45 PM"];
  const selectedDay = days.find((d) => d.key === date);
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) || null;

  const needsAddress = type === "in-person";
  const canSubmitStandard = Boolean(time) && (!needsAddress || Boolean(selectedAddress));
  const canSubmitAdvance = Boolean(advanceDate) && Boolean(advanceTime) && reason.trim().length > 0 && (!needsAddress || Boolean(selectedAddress));

  const handleSaveNewAddress = () => {
    if (!newAddress.label.trim() || !newAddress.address.trim() || !newAddress.phone.trim()) return;
    const saved = addAddress(newAddress);
    const next = getAddresses();
    setAddresses(next);
    setSelectedAddressId(saved.id);
    setShowAddressForm(false);
    setNewAddress({ label: "", recipient: "", phone: "", address: "" });
  };

  const handleConfirmStandard = () => {
    if (!canSubmitStandard) return;
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      setResult("confirmed");
      onConfirmed?.(doctor, { date: selectedDay, time, type, address: needsAddress ? selectedAddress : null, bookingFor });
    }, 700);
  };

  const handleSubmitAdvanceRequest = () => {
    if (!canSubmitAdvance) return;
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      setResult("requested");
      onRequestSubmitted?.(doctor, {
        date: advanceDate,
        time: advanceTime,
        type,
        reason: reason.trim(),
        notes: notes.trim(),
        address: needsAddress ? selectedAddress : null,
        bookingFor,
      });
    }, 700);
  };

  const advanceDateLabel = advanceDate
    ? new Date(`${advanceDate}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "";

  const isForOther = bookingFor && !bookingFor.isSelf;
  const awaitingAcceptance = isForOther && bookingFor.isDependent === false;

  const AddressStep = (
    <div className="sabi-booking-section">
      <span className="sabi-booking-label"><MapPin size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} /> Visit Address</span>
      <p className="sabi-booking-advance-note" style={{ marginTop: 0, marginBottom: 10 }}>
        {doctor.name} will come to this address for the in-person visit.
      </p>
      {addresses.length > 0 && (
        <div className="sabi-booking-address-grid">
          {addresses.map((addr) => (
            <button
              type="button"
              key={addr.id}
              className={`sabi-booking-address-card ${selectedAddressId === addr.id ? "selected" : ""}`}
              onClick={() => { setSelectedAddressId(addr.id); setShowAddressForm(false); }}
            >
              {selectedAddressId === addr.id && <span className="check"><Check size={14} /></span>}
              <strong>{addr.label}</strong>
              <span>{addr.address}</span>
            </button>
          ))}
          <button type="button" className="sabi-booking-address-add" onClick={() => setShowAddressForm((s) => !s)}>
            <Plus size={14} /> Use a different address
          </button>
        </div>
      )}

      {showAddressForm && (
        <div className="sabi-booking-address-form">
          <input type="text" placeholder="Label (e.g. Home)" value={newAddress.label} onChange={(e) => setNewAddress((p) => ({ ...p, label: e.target.value }))} />
          <input type="text" placeholder="Recipient Name" value={newAddress.recipient} onChange={(e) => setNewAddress((p) => ({ ...p, recipient: e.target.value }))} />
          <input type="text" placeholder="Phone Number" value={newAddress.phone} onChange={(e) => setNewAddress((p) => ({ ...p, phone: e.target.value }))} />
          <input type="text" placeholder="Street, area, city" value={newAddress.address} onChange={(e) => setNewAddress((p) => ({ ...p, address: e.target.value }))} />
          <button type="button" className="sabi-doctor-outline" onClick={handleSaveNewAddress}>Save Address</button>
        </div>
      )}
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
              <strong>{advanceDateLabel}</strong> at <strong>{advanceTime}</strong>.
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
              <img src={doctor.photo} alt={doctor.name} />
              <div>
                <strong>{doctor.name}</strong>
                <span>{doctor.specialty} · {doctor.experience}+ yrs experience</span>
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
                  onClick={() => setType("in-person")}
                >
                  <User2 size={16} /> In-Person
                </button>
                <button
                  type="button"
                  className={type === "virtual" ? "active" : ""}
                  onClick={() => setType("virtual")}
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
                        key={slot}
                        type="button"
                        className={time === slot ? "active" : ""}
                        onClick={() => setTime(slot)}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sabi-booking-footer">
                  <div>
                    <small>Consultation Fee</small>
                    <strong>₦{doctor.fee.toLocaleString()}</strong>
                  </div>
                  <button
                    type="button"
                    className="sabi-doctor-primary sabi-booking-confirm"
                    disabled={!canSubmitStandard || submitting}
                    onClick={handleConfirmStandard}
                  >
                    {submitting ? "Confirming…" : "Confirm Appointment"}
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
                      onChange={(e) => setAdvanceDate(e.target.value)}
                    />
                  </label>
                  <label className="sabi-booking-field">
                    <span className="sabi-booking-label">Preferred Time</span>
                    <input
                      type="time"
                      value={advanceTime}
                      onChange={(e) => setAdvanceTime(e.target.value)}
                    />
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

                <div className="sabi-booking-footer">
                  <div>
                    <small>Consultation Fee</small>
                    <strong>₦{doctor.fee.toLocaleString()}</strong>
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

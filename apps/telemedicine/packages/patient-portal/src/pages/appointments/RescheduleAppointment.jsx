import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "design-system";
import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { ArrowLeft, CalendarDays, CalendarPlus } from "lucide-react";

import { Sidebar, Topbar } from "../dashboard/components";
import { AppointmentCalendar } from "./components";
import { toCalendarDate } from "./components/AppointmentCalendar";
import { useApiData } from "../../api/useApiData";
import { getUiAppointment, listDoctorSlots, rescheduleDoctorAppointment } from "../../api/doctorsApi";
import { ConfirmModal } from "./ConfirmModal";

import "../dashboard/Dashboard.css";
import "./Appointments.css";

const localKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const timeLabel = (iso) => new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

function nextDays(count = 6) {
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

export function RescheduleAppointment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [zoom] = useZoom();

  const { data: appointment, loading, error } = useApiData(() => getUiAppointment(id), [id]);

  const [mode, setMode] = useState("standard"); // "standard" | "advance"

  const standardDays = useMemo(() => nextDays(6), []);
  const [selectedDate, setSelectedDate] = useState(() => toCalendarDate(new Date()));
  const [standardDay, setStandardDay] = useState(standardDays[0]?.key);
  const [selectedTime, setSelectedTime] = useState(""); // selected slot id

  const advanceMin = useMemo(() => {
    const last = standardDays[standardDays.length - 1];
    const d = last ? new Date(`${last.key}T00:00:00`) : new Date();
    d.setDate(d.getDate() + 1);
    return localKey(d);
  }, [standardDays]);
  const [advanceDate, setAdvanceDate] = useState(advanceMin);
  const [advanceTime, setAdvanceTime] = useState(""); // selected slot id

  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [done, setDone] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // The same doctor's open times (next two weeks, and on the chosen later date).
  const [openSlots, setOpenSlots] = useState(null);
  const [advanceSlots, setAdvanceSlots] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    if (!appointment) return undefined;
    let live = true;
    listDoctorSlots(appointment.doctorProfileId).then(
      (items) => {
        if (!live) return;
        setOpenSlots(items);
        // Start on the first day that has open times for this consultation type.
        const openKeys = new Set(items.filter((s) => s.consultationTypes.includes(appointment.consultationType)).map((s) => localKey(new Date(s.startsAt))));
        setStandardDay((current) => (openKeys.has(current) ? current : standardDays.find((d) => openKeys.has(d.key))?.key ?? current));
      },
      () => live && setOpenSlots([]),
    );
    return () => { live = false; };
  }, [appointment, refreshKey, standardDays]);
  useEffect(() => {
    if (!appointment || mode !== "advance" || !advanceDate) return undefined;
    let live = true;
    setAdvanceSlots(null);
    listDoctorSlots(appointment.doctorProfileId, new Date(`${advanceDate}T00:00:00`)).then(
      (items) => live && setAdvanceSlots(items.filter((s) => localKey(new Date(s.startsAt)) === advanceDate)),
      () => live && setAdvanceSlots([]),
    );
    return () => { live = false; };
  }, [appointment, mode, advanceDate, refreshKey]);

  if (!appointment || !appointment.canChange) {
    return (
      <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
        <Sidebar />
        <div className="sabi-main">
          <Topbar />
          <div className="sabi-card">
            <p>
              {loading && !appointment
                ? "Loading appointment…"
                : error
                ? "We couldn't find that appointment."
                : "This appointment can't be rescheduled any more. It may have been cancelled, declined or already started."}
            </p>
            <button className="sabi-btn-primary" onClick={() => navigate("/appointments")}>Back to Appointments</button>
          </div>
        </div>
      </div>
    );
  }

  // Slots the doctor offers for this appointment's consultation type.
  const sameType = (slot) => slot.consultationTypes.includes(appointment.consultationType);
  const openDayKeys = new Set((openSlots || []).filter(sameType).map((s) => localKey(new Date(s.startsAt))));
  const daySlots = (openSlots || []).filter((s) => sameType(s) && localKey(new Date(s.startsAt)) === standardDay);
  const advanceOptions = (advanceSlots || []).filter(sameType);

  const reschedule = async (slotId, note) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await rescheduleDoctorAppointment(appointment.id, { slotId });
      setDone(note ? "advance" : "standard");
    } catch (err) {
      setSubmitError(err.code === "SLOT_UNAVAILABLE" ? "That time was just taken. Please choose another." : err.message);
      setSelectedTime("");
      setAdvanceTime("");
      setRefreshKey((k) => k + 1);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmStandard = (e) => {
    e.preventDefault();
    if (!selectedTime) return;
    reschedule(selectedTime);
  };

  const confirmAdvance = (e) => {
    e.preventDefault();
    if (!advanceDate || !advanceTime) return;
    reschedule(advanceTime, reason || "later date");
  };

  if (done) {
    return (
      <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
        <Sidebar />
        <div className="sabi-main">
          <Topbar />
          <div className="sabi-card sabi-resched-done-card">
            <h2 className="sabi-resched-done-title">Reschedule Request Sent</h2>
            <p className="sabi-resched-done-text">
              {done === "standard"
                ? "Your new date and time has been sent to the doctor to confirm."
                : "This is now Pending Review — you'll be notified once it's confirmed."}
            </p>
            <button type="button" className="sabi-btn-primary" onClick={() => navigate("/appointments")}>
              Back to Appointments
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar placeholder="Search appointments, doctors..." showHelp />

        <div className="sabi-resched-header">
          <Link to="/appointments" className="sabi-resched-back" aria-label="Back to appointments">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1>Reschedule Appointment</h1>
            <p>Update your booking for specialized care</p>
          </div>
        </div>

        <div className="sabi-grid sabi-resched-grid">
          <div className="sabi-col">
            <div className="sabi-card sabi-resched-current">
              <div className="sabi-apt-avatar" style={{ background: appointment.color }}>{appointment.initials}</div>
              <div className="sabi-resched-current-body">
                <div className="sabi-resched-current-top">
                  <span className="sabi-resched-current-name">{appointment.doctor}</span>
                  <span className="sabi-resched-booking-pill">Active Booking</span>
                </div>
                <div className="sabi-resched-current-sub">{appointment.specialty} · {appointment.location}</div>
                <div className="sabi-resched-current-when">{appointment.date} · {appointment.time}</div>
              </div>
            </div>

            <div className="sabi-booking-mode-row sabi-resched-mode-row">
              <button type="button" className={mode === "standard" ? "active" : ""} onClick={() => setMode("standard")}>
                <CalendarDays size={16} /> Reschedule Now
              </button>
              <button type="button" className={mode === "advance" ? "active" : ""} onClick={() => setMode("advance")}>
                <CalendarPlus size={16} /> Book in Advance
              </button>
            </div>

            {mode === "standard" && (
              <div className="sabi-card sabi-apt-calendar">
                <AppointmentCalendar selectedDate={selectedDate} onDateSelect={setSelectedDate} appointments={[{ date: appointment.startsAt }]} />
              </div>
            )}
          </div>

          <div className="sabi-col">
            {mode === "standard" ? (
              <>
                <div className="sabi-card">
                  <h3 className="sabi-resched-panel-title">Select New Time</h3>
                  <p className="sabi-resched-panel-sub">Available slots for the next 6 days</p>

                  <div className="sabi-booking-days sabi-resched-days">
                    {standardDays.map((d) => (
                      <button
                        key={d.key}
                        type="button"
                        className={standardDay === d.key ? "active" : ""}
                        disabled={openSlots !== null && !openDayKeys.has(d.key)}
                        onClick={() => { setStandardDay(d.key); setSelectedTime(""); }}
                      >
                        <small>{d.weekday}</small>
                        <strong>{d.day}</strong>
                      </button>
                    ))}
                  </div>

                  <div className="sabi-resched-slots">
                    {daySlots.map((slot) => (
                      <button
                        type="button"
                        key={slot.id}
                        className={"sabi-resched-slot" + (slot.id === selectedTime ? " selected" : "")}
                        onClick={() => setSelectedTime(slot.id)}
                      >
                        {timeLabel(slot.startsAt)}
                      </button>
                    ))}
                  </div>
                  {openSlots !== null && !daySlots.length && (
                    <p className="sabi-resched-panel-sub">No open times this day. Pick another day or use Book in Advance.</p>
                  )}
                  {submitError && <p className="sabi-form-error" role="alert">{submitError}</p>}
                </div>

                <Button variant="primary" className="sabi-resched-confirm-btn" disabled={submitting || !selectedTime} onClick={confirmStandard}>
                  {submitting ? "Rescheduling…" : "Confirm Reschedule"}
                </Button>
              </>
            ) : (
              <>
                <div className="sabi-card">
                  <h3 className="sabi-resched-panel-title">Request a Later Date</h3>
                  <p className="sabi-resched-panel-sub">
                    For dates beyond the standard window — this will need to be reviewed before it's confirmed.
                  </p>

                  <div className="sabi-resched-advance-grid">
                    <label className="sabi-booking-field">
                      <span className="sabi-booking-label">Preferred Date</span>
                      <input type="date" min={advanceMin} value={advanceDate} onChange={(e) => { setAdvanceDate(e.target.value); setAdvanceTime(""); }} />
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

                  <label className="sabi-resched-reason-label" htmlFor="reschedule-reason">
                    Reason for Rescheduling (Optional)
                  </label>
                  <textarea
                    id="reschedule-reason"
                    className="sabi-resched-reason"
                    rows={3}
                    placeholder="Tell us why you are changing the appointment..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  {submitError && <p className="sabi-form-error" role="alert">{submitError}</p>}
                </div>

                <Button variant="primary" className="sabi-resched-confirm-btn" disabled={submitting || !advanceDate || !advanceTime} onClick={confirmAdvance}>
                  {submitting ? "Sending…" : "Send Reschedule Request"}
                </Button>
              </>
            )}

            <button
              type="button"
              className="sabi-apt-secondary-btn sabi-resched-cancel"
              onClick={() => setShowCancelConfirm(true)}
            >
              Cancel &amp; Go Back
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showCancelConfirm}
        title="Cancel rescheduling?"
        message="Any changes you've made to this reschedule will be lost. This won't affect your original appointment."
        confirmLabel="Yes, Cancel"
        cancelLabel="Keep Editing"
        danger
        onConfirm={() => navigate("/appointments")}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </div>
  );
}

export default RescheduleAppointment;

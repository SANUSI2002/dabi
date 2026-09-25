import React, { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "design-system";
import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { ArrowLeft, CalendarDays, CalendarPlus } from "lucide-react";

import { Sidebar, Topbar } from "../dashboard/components";
import { RESCHEDULE_SLOTS } from "./data";
import { AppointmentCalendar } from "./components";
import { toCalendarDate } from "./components/AppointmentCalendar";
import { getAppointments, rescheduleAppointment, requestRescheduleInAdvance } from "./appointmentStore";
import { ConfirmModal } from "./ConfirmModal";

import "../dashboard/Dashboard.css";
import "./Appointments.css";

function nextDays(count = 6) {
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

export function RescheduleAppointment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [zoom] = useZoom();

  const appointment = useMemo(() => {
    const all = getAppointments();
    return all.find((a) => a.id === id) || all[0];
  }, [id]);

  const [mode, setMode] = useState("standard"); // "standard" | "advance"

  const standardDays = useMemo(() => nextDays(6), []);
  const [selectedDate, setSelectedDate] = useState(() =>
    toCalendarDate(appointment?.date) || toCalendarDate(new Date())
  );
  const [standardDay, setStandardDay] = useState(standardDays[0]?.key);
  const [selectedTime, setSelectedTime] = useState("10:00 AM");

  const advanceMin = useMemo(() => {
    const last = standardDays[standardDays.length - 1];
    const d = last ? new Date(`${last.key}T00:00:00`) : new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, [standardDays]);
  const [advanceDate, setAdvanceDate] = useState(advanceMin);
  const [advanceTime, setAdvanceTime] = useState("");

  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  if (!appointment) {
    return (
      <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
        <Sidebar />
        <div className="sabi-main">
          <Topbar />
          <div className="sabi-card">
            <p>We couldn&apos;t find that appointment.</p>
            <button className="sabi-btn-primary" onClick={() => navigate("/appointments")}>Back to Appointments</button>
          </div>
        </div>
      </div>
    );
  }

  const confirmStandard = (e) => {
    e.preventDefault();
    setSubmitting(true);
    const dayLabel = new Date(`${standardDay}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    window.setTimeout(() => {
      rescheduleAppointment(appointment.id, { date: dayLabel, time: selectedTime });
      setSubmitting(false);
      setDone("standard");
    }, 500);
  };

  const confirmAdvance = (e) => {
    e.preventDefault();
    if (!advanceDate || !advanceTime) return;
    setSubmitting(true);
    window.setTimeout(() => {
      requestRescheduleInAdvance(appointment.id, { date: advanceDate, time: advanceTime, reason });
      setSubmitting(false);
      setDone("advance");
    }, 500);
  };

  if (done) {
    return (
      <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
        <Sidebar />
        <div className="sabi-main">
          <Topbar />
          <div className="sabi-card sabi-resched-done-card">
            <h2 className="sabi-resched-done-title">{done === "standard" ? "Appointment Rescheduled" : "Reschedule Request Sent"}</h2>
            <p className="sabi-resched-done-text">
              {done === "standard"
                ? "Your appointment has been updated to the new date and time."
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
                <AppointmentCalendar selectedDate={selectedDate} onDateSelect={setSelectedDate} appointments={getAppointments()} />
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
                        onClick={() => setStandardDay(d.key)}
                      >
                        <small>{d.weekday}</small>
                        <strong>{d.day}</strong>
                      </button>
                    ))}
                  </div>

                  <div className="sabi-resched-slots">
                    {RESCHEDULE_SLOTS.map((slot) => (
                      <button
                        type="button"
                        key={slot}
                        className={"sabi-resched-slot" + (slot === selectedTime ? " selected" : "")}
                        onClick={() => setSelectedTime(slot)}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>

                <Button variant="primary" className="sabi-resched-confirm-btn" disabled={submitting} onClick={confirmStandard}>
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
                      <input type="date" min={advanceMin} value={advanceDate} onChange={(e) => setAdvanceDate(e.target.value)} />
                    </label>
                    <label className="sabi-booking-field">
                      <span className="sabi-booking-label">Preferred Time</span>
                      <input type="time" value={advanceTime} onChange={(e) => setAdvanceTime(e.target.value)} />
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

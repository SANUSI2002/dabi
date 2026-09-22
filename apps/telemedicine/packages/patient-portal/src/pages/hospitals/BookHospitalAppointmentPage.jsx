import React, { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, CalendarDays, CalendarPlus, Check, Clock3, Info,
  MapPin, Shield, Star, Stethoscope, User, Users, Video, X,
} from "lucide-react";

import "../../styles/share.css";
import "./Hospitals.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { getHospital, getSpecialistsForHospital, isEnrolled } from "./hospitalStore";
import { addHospitalAppointment, addHospitalAppointmentRequest } from "../appointments/appointmentStore";
import { getMembers } from "../family/familyStore";

function nextDays(count = 7) {
  const days = [];
  const today = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      key: d.toISOString().slice(0, 10),
      weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
      day: d.getDate(),
      label: d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
    });
  }
  return days;
}

function minAdvanceDate(days) {
  const last = days[days.length - 1];
  const d = last ? new Date(`${last.key}T00:00:00`) : new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

const SLOTS = ["09:00 AM", "10:30 AM", "11:00 AM", "01:30 PM", "03:00 PM", "04:30 PM"];

export function BookHospitalAppointmentPage() {
  const [zoom] = useZoom();
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hospital = getHospital(id);

  const members = getMembers();
  const presetMemberId = searchParams.get("memberId");
  const [bookingForId, setBookingForId] = useState(presetMemberId || members.find((m) => m.isSelf)?.id || "self");
  const bookingFor = members.find((m) => m.id === bookingForId) || members[0];

  const [type, setType] = useState("virtual");
  const [department, setDepartment] = useState(hospital?.departments[0] || "");
  const [specialistId, setSpecialistId] = useState(null);
  const [profileSpecialist, setProfileSpecialist] = useState(null);

  const [mode, setMode] = useState("standard"); // "standard" | "advance"
  const days = useMemo(() => nextDays(7), []);
  const [date, setDate] = useState(days[0]?.key);
  const [time, setTime] = useState(null);

  const advanceMin = useMemo(() => minAdvanceDate(days), [days]);
  const [advanceDate, setAdvanceDate] = useState(advanceMin);
  const [advanceTime, setAdvanceTime] = useState("");

  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(null);
  const [requested, setRequested] = useState(null);

  if (!hospital) {
    return (
      <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
        <Sidebar />
        <div className="sabi-main">
          <Topbar />
          <div className="sabi-card">
            <p>We couldn&apos;t find that hospital.</p>
            <button className="sabi-btn-primary" onClick={() => navigate("/hospitals")}>Back to Hospitals</button>
          </div>
        </div>
      </div>
    );
  }

  const specialists = useMemo(() => getSpecialistsForHospital(hospital.id, department), [hospital.id, department]);
  const specialist = specialists.find((s) => s.id === specialistId) || null;
  const selectedDay = days.find((d) => d.key === date);
  const bookingForEnrolled = isEnrolled(bookingForId, hospital.id);

  const canConfirmStandard = type === "virtual" ? Boolean(specialist) && Boolean(time) : Boolean(time);
  const canSubmitAdvance = Boolean(advanceDate) && Boolean(advanceTime) && reason.trim().length > 0 && (type !== "virtual" || Boolean(specialist));

  const handleConfirmStandard = () => {
    if (!canConfirmStandard) return;
    setSubmitting(true);
    window.setTimeout(() => {
      const appointment = addHospitalAppointment({
        hospital,
        specialist: type === "virtual" ? specialist : null,
        department,
        date: selectedDay?.label,
        time,
        type,
        reason,
        bookedFor: bookingFor?.name,
      });
      setSubmitting(false);
      setConfirmed(appointment);
    }, 700);
  };

  const handleSubmitAdvance = () => {
    if (!canSubmitAdvance) return;
    setSubmitting(true);
    window.setTimeout(() => {
      const appointment = addHospitalAppointmentRequest({
        hospital,
        department,
        memberName: bookingFor?.name,
        date: advanceDate,
        time: advanceTime,
        type,
        reason,
      });
      setSubmitting(false);
      setRequested(appointment);
    }, 700);
  };

  if (confirmed || requested) {
    const result = confirmed || requested;
    return (
      <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
        <Sidebar />
        <div className="sabi-main">
          <Topbar />
          <div className="sabi-card sabi-hospitals-enroll-success">
            <div className={`icon${requested ? " pending" : ""}`}>{requested ? <Clock3 size={36} /> : <Check size={36} />}</div>
            <h2>{requested ? "Request Sent" : "Appointment Booked"}</h2>
            <p>
              {requested ? (
                <>
                  Your request for {bookingFor?.name} at {hospital.name} on <strong>{result.date}</strong> at{" "}
                  <strong>{result.time}</strong> is now <strong>Pending Review</strong>.
                </>
              ) : (
                <>
                  {bookingFor?.name} is booked {specialist ? <>with <strong>{specialist.name}</strong></> : `for the ${department} department`} at{" "}
                  {hospital.name} on <strong>{result.date}</strong> at <strong>{result.time}</strong>.
                </>
              )}
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button type="button" className="sabi-btn-outline" onClick={() => navigate("/appointments")}>View My Appointments</button>
              {confirmed && (
                <button type="button" className="sabi-btn-primary" onClick={() => navigate(`/hospitals/check-in/${confirmed.id}`)}>
                  Go to Check-in
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main sabi-hospitals-main">
        <Topbar placeholder="Search doctors, clinics..." />

        <button className="sabi-rxd-back" onClick={() => navigate(`/hospitals/${hospital.id}`)}>
          <ArrowLeft size={18} /> Back to {hospital.name}
        </button>

        <header className="sabi-hospitals-wizard-header">
          <div>
            <h1>Book Your Appointment</h1>
            <p>Empathetic care, precision results. Choose your preferred mode of consultation at {hospital.name}.</p>
          </div>
        </header>

        <div className="sabi-card sabi-hospitals-booking-for">
          <span className="sabi-booking-label"><Users size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} /> Booking For</span>
          {presetMemberId ? (
            <div className="sabi-hospitals-booking-for-locked">
              <strong>{bookingFor?.isSelf ? "Myself" : bookingFor?.name}</strong>
            </div>
          ) : (
            <div className="sabi-hospitals-booking-for-row">
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`sabi-hospitals-booking-for-chip ${bookingForId === m.id ? "active" : ""}`}
                  onClick={() => setBookingForId(m.id)}
                >
                  {m.isSelf ? "Myself" : m.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {!bookingForEnrolled ? (
          <div className="sabi-card sabi-hospitals-enroll-required">
            <Shield size={22} />
            <div>
              <strong>{bookingFor?.isSelf ? "You" : bookingFor?.name} must be enrolled as a patient at {hospital.name} first.</strong>
              <span>Hospitals only accept appointment bookings from enrolled patients — enrollment only takes a few minutes.</span>
            </div>
            <button
              type="button"
              className="sabi-btn-primary"
              onClick={() => navigate(`/hospitals/${hospital.id}/enroll${bookingForId ? `?memberId=${bookingForId}` : ""}`)}
            >
              Enroll {bookingFor?.isSelf ? "Myself" : bookingFor?.name}
            </button>
          </div>
        ) : (
          <div className="sabi-hospitals-wizard-layout">
            <div className="sabi-hospitals-booking-steps">
              <div className="sabi-card sabi-hospitals-wizard-card">
                <h3><span className="sabi-hospitals-step-num">1</span> Consultation Type</h3>
                <div className="sabi-hospitals-type-grid">
                  <button type="button" className={`sabi-hospitals-type-card ${type === "virtual" ? "active" : ""}`} onClick={() => { setType("virtual"); setSpecialistId(null); }}>
                    <Video size={22} />
                    <strong>Virtual Consultation</strong>
                    <span>Connect via encrypted HD video — choose your specialist.</span>
                  </button>
                  <button type="button" className={`sabi-hospitals-type-card ${type === "physical" ? "active" : ""}`} onClick={() => { setType("physical"); setSpecialistId(null); }}>
                    <MapPin size={22} />
                    <strong>Physical Visit</strong>
                    <span>In-person at {hospital.name} — a specialist is assigned on arrival.</span>
                  </button>
                </div>
              </div>

              <div className="sabi-card sabi-hospitals-wizard-card">
                <h3><span className="sabi-hospitals-step-num">2</span> Department{type === "virtual" ? " & Specialist" : ""}</h3>
                <label className="sabi-booking-field" style={{ marginBottom: 12 }}>
                  <span className="sabi-booking-label">Department</span>
                  <select value={department} onChange={(e) => { setDepartment(e.target.value); setSpecialistId(null); }}>
                    {hospital.departments.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </label>

                {type === "virtual" ? (
                  <>
                    <span className="sabi-booking-label">Available Specialists in {department}</span>
                    <div className="sabi-hospitals-specialist-grid">
                      {specialists.map((s) => (
                        <div key={s.id} className={`sabi-hospitals-specialist-card ${specialistId === s.id ? "active" : ""}`}>
                          <button type="button" className="sabi-hospitals-specialist-pick" onClick={() => setSpecialistId(s.id)}>
                            <div className="avatar"><Stethoscope size={20} /></div>
                            <div>
                              <strong>{s.name}</strong>
                              <span>{s.title}</span>
                              <span className="rating"><Star size={12} fill="currentColor" /> {s.rating} ({s.reviews} reviews)</span>
                            </div>
                          </button>
                          <div className="sabi-hospitals-specialist-actions">
                            {specialistId === s.id && <Check size={18} className="check" />}
                            <button type="button" className="sabi-hospitals-view-profile-btn" onClick={() => setProfileSpecialist(s)}>
                              <Info size={13} /> View Profile
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="sabi-hospitals-wizard-note">
                    For physical visits, a {department} specialist is assigned to you at reception based on availability —
                    you don't need to pick one in advance.
                  </p>
                )}
              </div>

              <div className="sabi-card sabi-hospitals-wizard-card">
                <div className="sabi-booking-mode-row" style={{ marginBottom: 14 }}>
                  <button type="button" className={mode === "standard" ? "active" : ""} onClick={() => setMode("standard")}>
                    <CalendarDays size={16} /> Standard Booking
                  </button>
                  <button type="button" className={mode === "advance" ? "active" : ""} onClick={() => setMode("advance")}>
                    <CalendarPlus size={16} /> Book in Advance
                  </button>
                </div>

                {mode === "standard" ? (
                  <>
                    <h3 style={{ marginTop: 0 }}><span className="sabi-hospitals-step-num">3</span> Schedule &amp; Availability</h3>
                    <div className="sabi-booking-days" style={{ marginBottom: 14 }}>
                      {days.map((d) => (
                        <button key={d.key} type="button" className={date === d.key ? "active" : ""} onClick={() => { setDate(d.key); setTime(null); }}>
                          <small>{d.weekday}</small>
                          <strong>{d.day}</strong>
                        </button>
                      ))}
                    </div>
                    <span className="sabi-booking-label">Available Slots</span>
                    <div className="sabi-booking-slots">
                      {SLOTS.map((slot) => (
                        <button key={slot} type="button" className={time === slot ? "active" : ""} onClick={() => setTime(slot)}>
                          {slot}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <h3 style={{ marginTop: 0 }}><span className="sabi-hospitals-step-num">3</span> Request a Later Date</h3>
                    <p className="sabi-hospitals-wizard-note">
                      {hospital.name}'s standard schedule only covers the next 7 days. Request a date beyond that and the
                      hospital will review and confirm.
                    </p>
                    <div className="sabi-hospitals-form-grid">
                      <label className="sabi-booking-field">
                        <span className="sabi-booking-label">Preferred Date</span>
                        <input type="date" min={advanceMin} value={advanceDate} onChange={(e) => setAdvanceDate(e.target.value)} />
                      </label>
                      <label className="sabi-booking-field">
                        <span className="sabi-booking-label">Preferred Time</span>
                        <input type="time" value={advanceTime} onChange={(e) => setAdvanceTime(e.target.value)} />
                      </label>
                    </div>
                  </>
                )}
              </div>

              <div className="sabi-card sabi-hospitals-wizard-card">
                <h3><span className="sabi-hospitals-step-num">4</span> Reason for Visit</h3>
                <label className="sabi-booking-field">
                  <textarea rows={3} placeholder="Briefly describe why you're booking this appointment…" value={reason} onChange={(e) => setReason(e.target.value)} />
                </label>
              </div>
            </div>

            <aside className="sabi-hospitals-sidebar">
              <div className="sabi-card sabi-hospitals-booking-summary">
                <h4>Booking Summary</h4>
                <div className="row"><Users size={15} /><div><span>Booking For</span><strong>{bookingFor?.name}</strong></div></div>
                <div className="row"><Video size={15} /><div><span>Type</span><strong>{type === "virtual" ? "Virtual Consultation" : "Physical Visit"}</strong></div></div>
                <div className="row"><User size={15} /><div><span>{type === "virtual" ? "Specialist" : "Department"}</span><strong>{type === "virtual" ? (specialist?.name || "Not selected") : department}</strong>{specialist && type === "virtual" && <em>{specialist.title}</em>}</div></div>
                <div className="row"><Clock3 size={15} /><div><span>Time</span><strong>{mode === "standard" ? `${selectedDay?.label}${time ? ` at ${time}` : ""}` : `${advanceDate}${advanceTime ? ` at ${advanceTime}` : ""} (request)`}</strong></div></div>

                {mode === "standard" ? (
                  <button
                    type="button"
                    className="sabi-btn-primary sabi-btn-block"
                    style={{ marginTop: 14 }}
                    disabled={!canConfirmStandard || submitting}
                    onClick={handleConfirmStandard}
                  >
                    {submitting ? "Confirming…" : "Confirm Booking"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="sabi-btn-primary sabi-btn-block"
                    style={{ marginTop: 14 }}
                    disabled={!canSubmitAdvance || submitting}
                    onClick={handleSubmitAdvance}
                  >
                    {submitting ? "Sending…" : "Send Request"}
                  </button>
                )}
              </div>

              <div className="sabi-card sabi-hospitals-secure-note">
                <Shield size={18} />
                <div>
                  <strong>Encrypted &amp; Secure</strong>
                  <span>Your medical data is encrypted with enterprise-grade security and handled under NDPR standards.</span>
                </div>
              </div>
            </aside>
          </div>
        )}

        {profileSpecialist && (
          <div className="sabi-modal-overlay" onClick={() => setProfileSpecialist(null)}>
            <div className="sabi-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <div className="sabi-modal-head">
                <h3>{profileSpecialist.name}</h3>
                <button type="button" className="sabi-modal-close" onClick={() => setProfileSpecialist(null)} aria-label="Close"><X size={16} /></button>
              </div>
              <div className="sabi-hospitals-specialist-profile">
                <div className="avatar"><Stethoscope size={28} /></div>
                <div>
                  <strong>{profileSpecialist.title}</strong>
                  <span className="rating"><Star size={13} fill="currentColor" /> {profileSpecialist.rating} ({profileSpecialist.reviews} reviews)</span>
                  <span>{profileSpecialist.yearsExperience}+ years experience</span>
                </div>
              </div>
              <p className="sabi-hospitals-wizard-note" style={{ margin: "12px 0 16px" }}>{profileSpecialist.bio}</p>
              <button
                type="button"
                className="sabi-btn-primary sabi-btn-block"
                onClick={() => { setSpecialistId(profileSpecialist.id); setProfileSpecialist(null); }}
              >
                Select {profileSpecialist.name}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BookHospitalAppointmentPage;

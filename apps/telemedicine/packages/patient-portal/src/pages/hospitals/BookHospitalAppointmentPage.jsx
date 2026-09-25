import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, Check, Info, ShieldCheck, UserPlus } from "lucide-react";

import "../../styles/share.css";
import "./Hospitals.css";

import { useApiData } from "../../api/useApiData";
import { createHospitalAppointment, getHospital, listMyEnrollments } from "../../api/sabiApi";
import { LoadState, PageShell, formatDateTime, subjectKey, useCareSubjects } from "./hospitalShared";

const VISIT_TYPES = ["Consultation", "Follow-up", "Check-up", "Test or procedure"];
const PREFERRED_TIMES = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];

function upcomingDays(count = 14) {
  const today = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i + 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { key, weekday: d.toLocaleDateString("en-NG", { weekday: "short" }), day: d.getDate() };
  });
}

function bookingErrorMessage(error) {
  if (error.status === 404) return "Booking needs an approved enrollment at this hospital for the person you selected. Check the enrollment status and try again.";
  if (error.status === 400) return "Some details weren't accepted. Check the date and reason and try again.";
  return error.message;
}

export function BookHospitalAppointmentPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const hospital = useApiData(() => getHospital(id), [id]);
  const enrollments = useApiData(() => listMyEnrollments(), []);
  const { subjects, loading: subjectsLoading } = useCareSubjects();

  const hereEnrollments = (enrollments.data || []).filter((e) => e.hospitalId === id);
  const activeKeys = new Set(hereEnrollments.filter((e) => e.status === "ACTIVE").map((e) => subjectKey(e.dependentId)));
  const pendingHere = hereEnrollments.some((e) => e.status === "PENDING");
  const eligible = subjects.filter((s) => activeKeys.has(s.key));

  const days = useMemo(() => upcomingDays(14), []);
  const [subject, setSubject] = useState(searchParams.get("dependentId") || null);
  const [visitType, setVisitType] = useState(VISIT_TYPES[0]);
  const [date, setDate] = useState(days[0].key);
  const [time, setTime] = useState(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [requested, setRequested] = useState(null);

  useEffect(() => {
    if (eligible.length && !eligible.some((s) => s.key === subject)) setSubject(eligible[0].key);
  }, [eligible.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const chosen = eligible.find((s) => s.key === subject);
  const trimmedReason = reason.trim();
  const reasonOk = trimmedReason.length === 0 || trimmedReason.length >= 2;
  const ready = Boolean(chosen && date && time && reasonOk);

  const submit = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const requestedAt = new Date(`${date}T${time}:00`).toISOString();
      setRequested(await createHospitalAppointment({
        hospitalId: id, dependentId: chosen.dependentId, requestedAt, appointmentType: visitType, reason: trimmedReason || undefined,
      }));
    } catch (error) {
      setSubmitError(bookingErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (requested) {
    return (
      <PageShell mainClassName="sabi-main">
        <div className="sabi-card sabi-hospitals-enroll-success">
          <div className="icon"><Check size={36} /></div>
          <h2>Appointment requested</h2>
          <p>
            {requested.memberName ? `${requested.memberName}'s` : "Your"} {requested.appointmentType.toLowerCase()} at {hospital.data?.name} for{" "}
            <strong>{formatDateTime(requested.requestedAt)}</strong> is awaiting the hospital&apos;s confirmation. You&apos;ll see it
            change to Confirmed in your appointments, and you can check in once it&apos;s confirmed.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button type="button" className="sabi-btn-outline" onClick={() => navigate(`/hospitals/${id}`)}>Back to Hospital</button>
            <button type="button" className="sabi-btn-primary" onClick={() => navigate("/appointments")}>View Appointments</button>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell placeholder="Search hospitals...">
      <button className="sabi-rxd-back" onClick={() => navigate(`/hospitals/${id}`)}>
        <ArrowLeft size={18} /> Back to Hospital
      </button>

      <LoadState loading={hospital.loading || enrollments.loading || subjectsLoading} error={hospital.error || enrollments.error} onRetry={() => { hospital.reload(); enrollments.reload(); }} label="Loading booking details…">
        {hospital.data && (
          <>
            <header className="sabi-hospitals-wizard-header">
              <div>
                <h1>Book at {hospital.data.name}</h1>
                <p>Request a visit. The hospital confirms the time with you.</p>
              </div>
            </header>

            {eligible.length === 0 ? (
              <div className="sabi-card sabi-hospitals-enroll-required sabi-live-state">
                <UserPlus size={32} />
                <h3>{pendingHere ? "Enrollment awaiting approval" : "Enroll before booking"}</h3>
                <p>
                  {pendingHere
                    ? `${hospital.data.name} is still reviewing your enrollment. You can book as soon as it's approved.`
                    : `You need an approved enrollment at ${hospital.data.name} before you can book an appointment here.`}
                </p>
                {!pendingHere && <button type="button" className="sabi-btn-primary" onClick={() => navigate(`/hospitals/${id}/enroll`)}>Enroll as Patient</button>}
              </div>
            ) : (
              <div className="sabi-hospitals-wizard-layout">
                <div className="sabi-hospitals-booking-steps">
                  <div className="sabi-card sabi-hospitals-wizard-card">
                    <h3 style={{ marginTop: 0 }}><span className="sabi-hospitals-step-num">1</span> Who is the appointment for?</h3>
                    <div className="sabi-subject-picker" role="group" aria-label="Who is the appointment for">
                      {eligible.map((s) => (
                        <button type="button" key={s.key} aria-pressed={subject === s.key} onClick={() => setSubject(s.key)}>{s.name}</button>
                      ))}
                    </div>
                    {eligible.length < subjects.length && (
                      <p className="sabi-hospitals-wizard-note">Only people with an approved enrollment at this hospital are listed.</p>
                    )}
                  </div>

                  <div className="sabi-card sabi-hospitals-wizard-card">
                    <h3 style={{ marginTop: 0 }}><span className="sabi-hospitals-step-num">2</span> Visit type</h3>
                    <div className="sabi-booking-slots">
                      {VISIT_TYPES.map((t) => (
                        <button key={t} type="button" aria-pressed={visitType === t} className={visitType === t ? "active" : ""} onClick={() => setVisitType(t)}>{t}</button>
                      ))}
                    </div>
                  </div>

                  <div className="sabi-card sabi-hospitals-wizard-card">
                    <h3 style={{ marginTop: 0 }}><span className="sabi-hospitals-step-num">3</span> Preferred date &amp; time</h3>
                    <div className="sabi-booking-days" style={{ marginBottom: 14 }}>
                      {days.map((d) => (
                        <button key={d.key} type="button" aria-pressed={date === d.key} aria-label={`${d.weekday} ${d.day}`} className={date === d.key ? "active" : ""} onClick={() => setDate(d.key)}>
                          <small>{d.weekday}</small>
                          <strong>{d.day}</strong>
                        </button>
                      ))}
                    </div>
                    <span className="sabi-booking-label">Preferred time</span>
                    <div className="sabi-booking-slots">
                      {PREFERRED_TIMES.map((slot) => (
                        <button key={slot} type="button" aria-pressed={time === slot} className={time === slot ? "active" : ""} onClick={() => setTime(slot)}>{slot}</button>
                      ))}
                    </div>
                    <p className="sabi-hospitals-wizard-note"><Info size={14} /> This is a request, not a reserved slot — the hospital confirms or proposes a change.</p>
                  </div>

                  <div className="sabi-card sabi-hospitals-wizard-card">
                    <h3 style={{ marginTop: 0 }}><span className="sabi-hospitals-step-num">4</span> Reason for visit</h3>
                    <label className="sabi-booking-field">
                      <span className="sabi-booking-label">Optional — helps the hospital prepare</span>
                      <textarea rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Recurring headaches for two weeks" />
                    </label>
                    {!reasonOk && <p className="sabi-form-error">Add a little more detail, or leave the reason blank.</p>}
                  </div>
                </div>

                <aside className="sabi-hospitals-sidebar">
                  <div className="sabi-card sabi-hospitals-booking-summary">
                    <h4><CalendarClock size={16} /> Request summary</h4>
                    <div className="sabi-hospitals-review-grid">
                      <div><span>Patient</span><strong>{chosen?.name || "—"}</strong></div>
                      <div><span>Visit</span><strong>{visitType}</strong></div>
                      <div><span>Preferred</span><strong>{time ? formatDateTime(new Date(`${date}T${time}:00`).toISOString()) : "Choose a time"}</strong></div>
                    </div>
                    {submitError && <p className="sabi-form-error" role="alert">{submitError}</p>}
                    <button type="button" className="sabi-btn-primary sabi-btn-block" disabled={!ready || submitting} onClick={submit}>
                      {submitting ? "Sending request…" : "Request Appointment"}
                    </button>
                  </div>
                  <div className="sabi-card sabi-hospitals-secure-note">
                    <ShieldCheck size={16} /> Only {hospital.data.name} sees this request.
                  </div>
                </aside>
              </div>
            )}
          </>
        )}
      </LoadState>
    </PageShell>
  );
}

export default BookHospitalAppointmentPage;

import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Check, Info } from "lucide-react";

import "../../styles/share.css";
import "./Wellness.css";
import "../hospitals/Hospitals.css";

import { useApiData } from "../../api/useApiData";
import { bookWellness, getWellnessOffering } from "../../api/sabiApi";
import { LoadState, PageShell, formatDateTime, formatNaira } from "../hospitals/hospitalShared";
import { TimePicker } from "./TimePicker";
import { categoryLabel, toOffering } from "./wellnessStore";

function upcomingDays(count = 21) {
  const today = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i + 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { key, weekday: d.toLocaleDateString("en-NG", { weekday: "short" }), day: d.getDate() };
  });
}

export function BookPractitionerPage() {
  const { categoryId, practitionerId } = useParams();
  const navigate = useNavigate();
  const offering = useApiData(async () => toOffering(await getWellnessOffering(practitionerId)), [practitionerId]);

  const days = useMemo(() => upcomingDays(21), []);
  const [date, setDate] = useState(days[0].key);
  const [time, setTime] = useState("09:00");
  const [context, setContext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [booked, setBooked] = useState(null);

  const trimmed = context.trim();
  const contextOk = trimmed.length === 0 || trimmed.length >= 2;
  const requestedAt = new Date(`${date}T${time}:00`).toISOString();

  const submit = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      setBooked(await bookWellness({ offeringId: practitionerId, requestedAt, context: trimmed || undefined }));
    } catch (error) {
      setSubmitError(error.status === 404 ? "This service is no longer available, or this account can't book wellness services." : error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (booked) {
    return (
      <PageShell mainClassName="sabi-main sabi-wellness-main">
        <div className="sabi-card sabi-hospitals-enroll-success">
          <div className="icon"><Check size={36} /></div>
          <h2>Booking requested</h2>
          <p>
            {offering.data?.providerName} will confirm your {offering.data?.name} booking for <strong>{formatDateTime(requestedAt)}</strong>.
            You&apos;ll see the status change in My Bookings.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button type="button" className="sabi-btn-outline" onClick={() => navigate("/wellness-hub")}>Back to Wellness Hub</button>
            <button type="button" className="sabi-btn-primary" onClick={() => navigate(`/wellness-hub/engagements/${booked.id}`)}>View Booking</button>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell mainClassName="sabi-main sabi-wellness-main">
      <button className="sabi-rxd-back" onClick={() => navigate(`/wellness-hub/${categoryId}/${practitionerId}`)}>
        <ArrowLeft size={18} /> Back to service
      </button>

      <LoadState loading={offering.loading} error={offering.error} onRetry={offering.reload} label="Loading service…">
        {offering.data && (
          <div className="sabi-hospitals-wizard-layout">
            <div className="sabi-card sabi-hospitals-wizard-card">
              <h1 style={{ marginTop: 0 }}>Book {offering.data.name}</h1>
              <p className="sabi-hospitals-wizard-note"><BadgeCheck size={14} /> {offering.data.providerName} · {categoryLabel(offering.data.category)}</p>

              <span className="sabi-booking-label">Preferred date</span>
              <div className="sabi-booking-days" style={{ margin: "8px 0 14px" }}>
                {days.map((d) => (
                  <button key={d.key} type="button" aria-pressed={date === d.key} aria-label={`${d.weekday} ${d.day}`} className={date === d.key ? "active" : ""} onClick={() => setDate(d.key)}>
                    <small>{d.weekday}</small>
                    <strong>{d.day}</strong>
                  </button>
                ))}
              </div>

              <TimePicker label="Preferred time" value={time} onChange={setTime} />

              <label className="sabi-booking-field" style={{ marginTop: 14 }}>
                <span className="sabi-booking-label">Anything the provider should know? (optional)</span>
                <textarea rows={3} maxLength={300} value={context} onChange={(e) => setContext(e.target.value)} placeholder="e.g. Post-surgery recovery, mobility support needed" />
              </label>
              {!contextOk && <p className="sabi-form-error">Add a little more detail, or leave this blank.</p>}
              <p className="sabi-hospitals-wizard-note"><Info size={14} /> This is a request — the provider confirms or declines it.</p>
            </div>

            <aside className="sabi-hospitals-sidebar">
              <div className="sabi-card sabi-hospitals-booking-summary">
                <h4>Booking summary</h4>
                <div className="sabi-hospitals-review-grid">
                  <div><span>Service</span><strong>{offering.data.name}</strong></div>
                  <div><span>Provider</span><strong>{offering.data.providerName}</strong></div>
                  <div><span>Preferred</span><strong>{formatDateTime(requestedAt)}</strong></div>
                  <div><span>Price</span><strong>{offering.data.price > 0 ? formatNaira(offering.data.price) : "On request"}</strong></div>
                </div>
                {submitError && <p className="sabi-form-error" role="alert">{submitError}</p>}
                <button type="button" className="sabi-btn-primary sabi-btn-block" disabled={!contextOk || submitting} onClick={submit}>
                  {submitting ? "Sending request…" : "Request Booking"}
                </button>
              </div>
            </aside>
          </div>
        )}
      </LoadState>
    </PageShell>
  );
}

export default BookPractitionerPage;

import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ChevronLeft, ChevronRight, MessageCircle, Pill, Plus, X } from "lucide-react";
import { PageShell } from "../hospitals/hospitalShared";
import { EmptyState, ErrorState, LoadingState, Notice, PageHeader } from "../../../../shared-portal/design-system/ui.jsx";
import {
  clockLabel, createSchedule, dosesForDay, getNotificationSettings, listScheduleSuggestions, listSchedules, recordDose, shiftDay, stopSchedule, updateSchedule,
} from "../../api/notificationsApi";
import "../notification-settings/NotificationSettings.css";

const DOSE_STATUS = { TAKEN: ["success", "Taken"], SKIPPED: ["neutral", "Skipped"], NOT_CONFIRMED: ["warning", "Not confirmed yet"] };
const SCHEDULE_STATUS = { ACTIVE: ["success", "Active"], PAUSED: ["warning", "Paused"], STOPPED: ["neutral", "Stopped"], COMPLETED: ["neutral", "Course finished"] };
const Badge = ({ map, status }) => { const [tone, label] = map[status] || ["neutral", status]; return <span className={`sx-badge sx-badge-${tone}`}>{label}</span>; };
const dayTitle = (day, today) => (day === today ? "Today" : day === shiftDay(today, -1) ? "Yesterday" : day === shiftDay(today, 1) ? "Tomorrow"
  : new Date(`${day}T12:00:00Z`).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" }));
const at = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** Times picker: a list of HH:MM inputs with add/remove. */
function TimesField({ id, times, onChange }) {
  return <div className="sx-field">
    <span className="sx-label" id={`${id}-label`}>Times to take it</span>
    <div className="md-times" role="group" aria-labelledby={`${id}-label`}>
      {times.map((time, i) => <span key={i} className="md-times">
        <input className="sx-input" type="time" required value={time} aria-label={`Time ${i + 1}`} onChange={(e) => onChange(times.map((t, j) => (j === i ? e.target.value : t)))} />
        {times.length > 1 && <button type="button" className="sx-btn sx-btn-ghost sx-btn-sm" aria-label={`Remove time ${i + 1}`} onClick={() => onChange(times.filter((_, j) => j !== i))}><X size={15} /></button>}
      </span>)}
      {times.length < 8 && <button type="button" className="sx-btn sx-btn-secondary sx-btn-sm" onClick={() => onChange([...times, "12:00"])}><Plus size={15} aria-hidden="true" /> Add a time</button>}
    </div>
  </div>;
}

function DoseRow({ dose, onRecorded }) {
  const [busy, setBusy] = useState(""), [error, setError] = useState("");
  const done = dose.status !== "NOT_CONFIRMED";
  const record = async (status) => {
    setBusy(status); setError("");
    try { onRecorded((await recordDose(dose.id, status)).dose); } catch (e) { setError(e.message); } finally { setBusy(""); }
  };
  const snoozed = dose.reminder?.status === "SNOOZED" ? `Reminder again at ${at(dose.reminder.dueAt)}` : null;
  return <li className={`md-dose${done ? " is-done" : ""}`}>
    <span className="md-time">{clockLabel(dose.localTime)}</span>
    <div className="sx-row-main">
      <p className="sx-row-title">{dose.medicine?.name}{dose.medicine?.dosage ? ` · ${dose.medicine.dosage}` : ""}</p>
      <p className="sx-row-meta">
        <Badge map={DOSE_STATUS} status={dose.status} />
        {dose.confirmedAt && ` ${at(dose.confirmedAt)}${dose.confirmedVia === "WHATSAPP" ? " · on WhatsApp" : ""}`}
        {snoozed && ` · ${snoozed}`}
        {dose.medicine?.instructions && ` · ${dose.medicine.instructions}`}
      </p>
      {error && <p className="sx-error-text" role="alert">{error}</p>}
    </div>
    <div className="sx-actions">
      {dose.status !== "TAKEN" && <button type="button" className="sx-btn sx-btn-primary sx-btn-sm" disabled={Boolean(busy)} onClick={() => record("TAKEN")}><CheckCircle2 size={15} aria-hidden="true" /> {busy === "TAKEN" ? "Saving…" : "Taken"}</button>}
      {dose.status === "NOT_CONFIRMED" && <button type="button" className="sx-btn sx-btn-secondary sx-btn-sm" disabled={Boolean(busy)} onClick={() => record("SKIPPED")}>{busy === "SKIPPED" ? "Saving…" : "Skip"}</button>}
    </div>
  </li>;
}

function DosesCard({ refreshKey }) {
  const [day, setDay] = useState(null), [today, setToday] = useState(null);
  const [result, setResult] = useState(null), [error, setError] = useState("");
  const load = useCallback((which) => {
    dosesForDay(which ?? undefined).then((r) => { setResult(r); setDay(r.day); setToday((t) => t ?? r.day); setError(""); }).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(day); }, [load, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = (count) => { const next = shiftDay(day, count); setDay(next); load(next); };
  const replace = (dose) => setResult((r) => ({ ...r, doses: r.doses.map((d) => (d.id === dose.id ? dose : d)) }));
  return <section className="sx-card" aria-labelledby="md-doses-title">
    <div className="sx-card-header md-day">
      <h2 id="md-doses-title" className="sx-card-title">{day && today ? dayTitle(day, today) : "Today"}</h2>
      {day && <div className="sx-actions">
        <button type="button" className="sx-btn sx-btn-ghost sx-btn-sm" onClick={() => go(-1)} aria-label="Previous day"><ChevronLeft size={16} /></button>
        {day !== today && <button type="button" className="sx-btn sx-btn-secondary sx-btn-sm" onClick={() => { setDay(today); load(today); }}>Today</button>}
        <button type="button" className="sx-btn sx-btn-ghost sx-btn-sm" onClick={() => go(1)} aria-label="Next day" disabled={day && today && day >= shiftDay(today, 1)}><ChevronRight size={16} /></button>
      </div>}
    </div>
    {error && !result ? <ErrorState title="We couldn't load your doses" message={error} onRetry={() => load(day)} />
      : !result ? <LoadingState label="Loading your doses…" />
      : !result.doses.length ? <EmptyState icon={Pill} title="No doses on this day">Set up a medicine below and its doses will appear here.</EmptyState>
      : <ul className="sx-list" style={{ listStyle: "none", margin: 0, padding: 0 }}>{result.doses.map((dose) => <DoseRow key={dose.id} dose={dose} onRecorded={replace} />)}</ul>}
    <p className="sx-hint" style={{ marginTop: 12 }}>A dose only counts as taken when you say so — here or with the Taken button on WhatsApp. A reminder being delivered or read doesn't change it.</p>
  </section>;
}

function SuggestionRow({ item, onDone }) {
  const [times, setTimes] = useState(item.suggestedTimes.length ? item.suggestedTimes : ["08:00"]);
  const [endDate, setEndDate] = useState(item.suggestedEndDate || "");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setError("");
    try { await createSchedule({ prescriptionItemId: item.prescriptionItemId, ...(item.asNeeded ? {} : { times, endDate: endDate || null }) }); onDone(); }
    catch (err) { setError(err.message); setBusy(false); }
  };
  return <form className="md-med" onSubmit={save}>
    <div className="md-med-head">
      <div><p className="sx-row-title">{item.medicationName} · {item.dosage}</p>
        <p className="sx-row-meta">{[item.prescriber && `Prescribed by ${item.prescriber}`, item.duration, item.indication].filter(Boolean).join(" · ")}</p></div>
      {item.asNeeded && <span className="sx-badge sx-badge-info">As needed</span>}
    </div>
    {item.asNeeded
      ? <p className="sx-hint">Take this only when you need it, so it has no set times or reminders.</p>
      : <div className="md-grid">
        <TimesField id={`sg-${item.prescriptionItemId}`} times={times} onChange={setTimes} />
        <div className="sx-field"><label htmlFor={`end-${item.prescriptionItemId}`}>Last day</label>
          <input id={`end-${item.prescriptionItemId}`} className="sx-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <span className="sx-hint">Suggested from "{item.duration}". Leave empty to keep going.</span></div>
      </div>}
    {error && <p className="sx-error-text" role="alert">{error}</p>}
    <div className="sx-actions"><button type="submit" className="sx-btn sx-btn-primary sx-btn-sm" disabled={busy}>{busy ? "Saving…" : item.asNeeded ? "Add to my medicines" : "Set up reminders"}</button></div>
  </form>;
}

function AddMedicine({ onDone, onCancel }) {
  const [form, setForm] = useState({ name: "", dosage: "", instructions: "", asNeeded: false, times: ["08:00"], endDate: "" });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setError("");
    try {
      await createSchedule({ name: form.name.trim(), dosage: form.dosage.trim() || null, instructions: form.instructions.trim() || null, asNeeded: form.asNeeded, ...(form.asNeeded ? {} : { times: form.times, endDate: form.endDate || null }) });
      onDone();
    } catch (err) { setError(err.message); setBusy(false); }
  };
  return <form className="md-med" onSubmit={save} aria-label="Add a medicine">
    <div className="md-grid">
      <div className="sx-field"><label htmlFor="md-name">Medicine</label><input id="md-name" className="sx-input" required maxLength={120} value={form.name} onChange={(e) => set("name")(e.target.value)} /></div>
      <div className="sx-field"><label htmlFor="md-dosage">Dose (optional)</label><input id="md-dosage" className="sx-input" maxLength={64} placeholder="e.g. 5 mg" value={form.dosage} onChange={(e) => set("dosage")(e.target.value)} /></div>
    </div>
    <div className="sx-field"><label htmlFor="md-instructions">Instructions (optional)</label><input id="md-instructions" className="sx-input" maxLength={500} placeholder="e.g. after food" value={form.instructions} onChange={(e) => set("instructions")(e.target.value)} /></div>
    <label className="ns-check"><input type="checkbox" checked={form.asNeeded} onChange={(e) => set("asNeeded")(e.target.checked)} /><span>I take this only when needed (no reminders)</span></label>
    {!form.asNeeded && <div className="md-grid">
      <TimesField id="md-new" times={form.times} onChange={set("times")} />
      <div className="sx-field"><label htmlFor="md-end">Last day (optional)</label><input id="md-end" className="sx-input" type="date" value={form.endDate} onChange={(e) => set("endDate")(e.target.value)} /></div>
    </div>}
    {error && <p className="sx-error-text" role="alert">{error}</p>}
    <div className="sx-actions">
      <button type="submit" className="sx-btn sx-btn-primary sx-btn-sm" disabled={busy}>{busy ? "Saving…" : "Save medicine"}</button>
      <button type="button" className="sx-btn sx-btn-ghost sx-btn-sm" onClick={onCancel}>Cancel</button>
    </div>
  </form>;
}

function ScheduleRow({ schedule, onChanged }) {
  const [editing, setEditing] = useState(false), [times, setTimes] = useState(schedule.times);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const live = schedule.status === "ACTIVE" || schedule.status === "PAUSED";
  const run = async (work) => {
    setBusy(true); setError("");
    try { await work(); setEditing(false); onChanged(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const stop = () => window.confirm(`Stop ${schedule.name}? Reminders end now; doses you've recorded stay in your history.`) && run(() => stopSchedule(schedule.id));
  return <li className="md-med">
    <div className="md-med-head">
      <div><p className="sx-row-title">{schedule.name}{schedule.dosage ? ` · ${schedule.dosage}` : ""}</p>
        <p className="sx-row-meta">{[schedule.asNeeded ? "As needed" : schedule.times.map(clockLabel).join(", "), schedule.source === "PRESCRIPTION" ? "Prescribed" : "Added by you",
          schedule.endDate && `until ${new Date(`${schedule.endDate}T12:00:00Z`).toLocaleDateString([], { day: "numeric", month: "short" })}`].filter(Boolean).join(" · ")}</p></div>
      <Badge map={SCHEDULE_STATUS} status={schedule.status} />
    </div>
    {editing && <form className="ns-form" onSubmit={(e) => { e.preventDefault(); run(() => updateSchedule(schedule.id, { times })); }}>
      <TimesField id={`ed-${schedule.id}`} times={times} onChange={setTimes} />
      <div className="sx-actions"><button type="submit" className="sx-btn sx-btn-primary sx-btn-sm" disabled={busy}>Save times</button><button type="button" className="sx-btn sx-btn-ghost sx-btn-sm" onClick={() => { setEditing(false); setTimes(schedule.times); }}>Cancel</button></div>
    </form>}
    {error && <p className="sx-error-text" role="alert">{error}</p>}
    {live && !editing && <div className="sx-actions">
      {!schedule.asNeeded && <button type="button" className="sx-btn sx-btn-secondary sx-btn-sm" disabled={busy} onClick={() => setEditing(true)}>Change times</button>}
      {!schedule.asNeeded && <button type="button" className="sx-btn sx-btn-secondary sx-btn-sm" disabled={busy} onClick={() => run(() => updateSchedule(schedule.id, { paused: schedule.status === "ACTIVE" }))}>{schedule.status === "ACTIVE" ? "Pause reminders" : "Resume reminders"}</button>}
      <button type="button" className="sx-btn sx-btn-danger sx-btn-sm" disabled={busy} onClick={stop}>Stop medicine</button>
    </div>}
  </li>;
}

/** My Medicines: today's doses (Taken / Skip), prescribed medicines to set up, and the patient's medicines. */
export function MedicinesPage() {
  const [schedules, setSchedules] = useState(null), [suggestions, setSuggestions] = useState([]);
  const [whatsappOn, setWhatsappOn] = useState(null);
  const [adding, setAdding] = useState(false), [error, setError] = useState(""), [refreshKey, setRefreshKey] = useState(0);
  const load = useCallback(() => {
    Promise.all([listSchedules(), listScheduleSuggestions()]).then(([s, g]) => { setSchedules(s); setSuggestions(g); setError(""); }).catch((e) => setError(e.message));
    getNotificationSettings().then((s) => setWhatsappOn(Boolean(s.whatsapp.connection))).catch(() => setWhatsappOn(null));
  }, []);
  useEffect(load, [load]);
  const changed = () => { load(); setRefreshKey((k) => k + 1); };

  return <PageShell mainClassName="sabi-main"><div className="sx-page ns-page">
    <PageHeader eyebrow="Medicines" title="My Medicines" description="When to take each medicine, and a record of each dose."
      actions={!adding && <button type="button" className="sx-btn sx-btn-primary" onClick={() => setAdding(true)}><Plus size={16} aria-hidden="true" /> Add a medicine</button>} />
    {whatsappOn === false && <Notice tone="info" title="Get reminders on WhatsApp">
      Tap Taken right from the reminder. <Link to="/settings/notifications" className="sx-link"><MessageCircle size={15} aria-hidden="true" /> Turn on WhatsApp reminders</Link>
    </Notice>}
    {adding && <AddMedicine onDone={() => { setAdding(false); changed(); }} onCancel={() => setAdding(false)} />}
    <DosesCard refreshKey={refreshKey} />
    {suggestions.length > 0 && <section className="sx-card" aria-labelledby="md-suggest-title">
      <div className="sx-card-header"><div><h2 id="md-suggest-title" className="sx-card-title">From your prescriptions</h2>
        <p className="sx-card-subtitle">Choose when you'll take each medicine. Times are suggested from the prescription.</p></div></div>
      <div className="sx-list">{suggestions.map((item) => <SuggestionRow key={item.prescriptionItemId} item={item} onDone={changed} />)}</div>
    </section>}
    <section className="sx-card" aria-labelledby="md-list-title">
      <div className="sx-card-header"><h2 id="md-list-title" className="sx-card-title">Your medicines</h2></div>
      {error && !schedules ? <ErrorState title="We couldn't load your medicines" message={error} onRetry={load} />
        : !schedules ? <LoadingState label="Loading your medicines…" />
        : !schedules.length ? <EmptyState icon={Pill} title="No medicines yet">Add a medicine, or set one up from a prescription.</EmptyState>
        : <ul className="sx-list" style={{ listStyle: "none", margin: 0, padding: 0 }}>{schedules.map((s) => <ScheduleRow key={`${s.id}-${s.version}`} schedule={s} onChanged={changed} />)}</ul>}
    </section>
  </div></PageShell>;
}

export default MedicinesPage;

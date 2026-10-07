import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CalendarDays, CalendarCheck, ClipboardList, Clock, FileText, RefreshCw, ShieldCheck, Stethoscope, Users, Video } from "lucide-react";
import PortalLayout from "../components/PortalLayout";
import { getCurrentDoctor, signOutDoctor } from "../store/doctorSession";
import { IDENTITY_UI_URL } from "../services/runtime";
import * as api from "./doctorApi";
import { groupPatients, localDay } from "./doctorData";
import { DateTile, EmptyState, ErrorState, LoadingState, Notice, PageHeader, StatusBadge, Tabs } from "../../../shared-portal/design-system/ui.jsx";
import "./LiveDoctorWorkspace.css";
import DailyConsultation from '../../../shared-video/DailyConsultation';
import ProfessionalAvailability from './ProfessionalAvailability';
import ProfessionalCareWorkspace from './ProfessionalCareWorkspace';

function useResource(loader, key = "") {
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: "" }));
    Promise.resolve().then(() => loader(controller.signal)).then((data) => {
      if (!controller.signal.aborted) setState({ loading: false, data, error: "" });
    }).catch((error) => { if (!controller.signal.aborted) setState((s) => ({ ...s, loading: false, error: error.message })); });
    return () => controller.abort();
  }, [key, version]); // Each caller supplies a key for changing request parameters.
  return { ...state, reload: () => setVersion((n) => n + 1) };
}
const time = (value) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const date = (value) => new Date(value).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
const weekday = (value) => new Date(value).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
const patientName = (a) => a.dependent?.name || a.patient?.name || "Patient";
const initials = (name) => name.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
const typeLabel = (a) => a.consultationType === "VIRTUAL" ? "Video consultation" : "In-person consultation";
// Every confirmed video consultation offers "Join video and chat", as before; the server opens the
// room 10 minutes before the start and closes it 15 minutes after the end, and says so if it's early.
const canJoin = (a) => a?.status === "CONFIRMED" && a.consultationType === "VIRTUAL";
// Whether the room is open right now (server rule), for wording such as "In progress".
const joinable = (a, now = Date.now()) => a?.status === "CONFIRMED" && a.consultationType === "VIRTUAL" && now >= new Date(a.startsAt).getTime() - 10 * 60_000 && now < new Date(a.endsAt).getTime() + 15 * 60_000;
/** When a consultation happens, relative where that helps: "Starts in 12 min · 10:00–10:30", "Tomorrow · 09:00–09:30". */
const when = (a, now = Date.now()) => {
  const range = `${time(a.startsAt)}–${time(a.endsAt)}`;
  const minutes = Math.round((new Date(a.startsAt).getTime() - now) / 60_000);
  if (minutes <= 0) return `${joinable(a, now) ? "In progress" : "Started"} · ${range}`;
  if (minutes < 60) return `Starts in ${minutes} min · ${range}`;
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  if (localDay(a.startsAt) === localDay(new Date(now))) return `Today · ${range}`;
  if (localDay(a.startsAt) === localDay(tomorrow)) return `Tomorrow · ${range}`;
  return `${new Date(a.startsAt).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })} · ${range}`;
};
// Professionals act on a request, so it reads as "Needs response" rather than the patient's wording.
const PRO_LABELS = { REQUESTED: "Needs response" };
function Status({ value }) { return <StatusBadge status={value} labels={PRO_LABELS} />; }
function Empty({ title, text, action }) { return <EmptyState icon={ClipboardList} title={title} action={action}>{text}</EmptyState>; }
function ResourceStatus({ resource }) {
  if (resource.loading && !resource.data) return <LoadingState label="Loading your workspace…" />;
  if (resource.error) return <ErrorState title="We couldn't load this page" message={resource.error} onRetry={resource.reload} />;
  return null;
}
function Page({ eyebrow = "Professional portal", title, description, resource, actions, children }) {
  return <PortalLayout topbarProps={{ title: "Sabi Health · Professional Portal" }}><div className="dl-page sx-page">
    <PageHeader eyebrow={eyebrow} title={title} description={description} actions={<>{actions}{resource && <button type="button" className="sx-btn sx-btn-secondary" disabled={resource.loading} onClick={resource.reload} aria-busy={resource.loading && !!resource.data}><RefreshCw size={16} aria-hidden="true" /> Refresh</button>}</>} />
    {resource && <ResourceStatus resource={resource} />}{(!resource || (!resource.error && (resource.data || !resource.loading))) && children}
  </div></PortalLayout>;
}
function AppointmentRow({ appointment: a, to, selected, onClick }) {
  const body = <><DateTile value={a.startsAt} /><div className="sx-row-main"><p className="sx-row-title">{patientName(a)}{a.dependentId ? <span className="dl-muted"> · Dependant</span> : null}</p><p className="sx-row-meta">{time(a.startsAt)}–{time(a.endsAt)} · {typeLabel(a)}</p></div><Status value={a.status} /></>;
  return to ? <Link to={to} className={`sx-row${selected ? " is-selected" : ""}`} aria-current={selected || undefined}>{body}</Link>
    : <button type="button" className={`sx-row${selected ? " is-selected" : ""}`} aria-current={selected || undefined} onClick={onClick}>{body}</button>;
}
function Dashboard() {
  const doctor = getCurrentDoctor();
  // Include consultations that started in the last hour so a call in progress stays visible.
  const resource = useResource((signal) => Promise.all([
    api.loadAppointments("limit=100&offset=0&status=CONFIRMED&from=" + encodeURIComponent(new Date(Date.now() - 60 * 60_000).toISOString()), signal),
    api.loadAppointments("limit=5&offset=0&status=REQUESTED", signal),
    api.loadSlots(signal),
  ]).then(([upcoming, requests, slots]) => ({ upcoming, requests, slots })));
  const data = resource.data;
  const upcoming = data ? [...data.upcoming.items].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)) : [];
  const next = upcoming.find((a) => new Date(a.endsAt).getTime() + 15 * 60_000 > Date.now());
  const today = upcoming.filter((a) => localDay(a.startsAt) === localDay(new Date()));
  const openSlots = data ? data.slots.items.filter((s) => s.state === "OPEN" && new Date(s.startsAt) > new Date()).length : 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const summary = data ? [`${today.length} ${today.length === 1 ? "consultation" : "consultations"} today`, `${data.requests.total} ${data.requests.total === 1 ? "request" : "requests"} waiting`].join(" · ") : weekday(new Date());
  return <Page eyebrow={weekday(new Date())} title={`${greeting}, ${doctor.firstNameGreeting || doctor.name}`} description={summary} resource={resource}
    actions={<>{next && <Link className="sx-btn sx-btn-primary" to={`/appointments/${next.id}${canJoin(next) ? "?join=1" : ""}`}>{canJoin(next) ? <><Video size={16} aria-hidden="true" /> Join next consultation</> : <>Open next consultation</>}</Link>}<Link className={`sx-btn ${next ? "sx-btn-secondary" : "sx-btn-primary"}`} to="/availability"><CalendarDays size={16} aria-hidden="true" /> Publish availability</Link></>}>
    {data && <>
      <div className="dl-stats">
        {[{ icon: Clock, label: "Awaiting your response", value: data.requests.total, to: "/appointments?status=REQUESTED", tone: data.requests.total ? "warning" : "" },
          { icon: CalendarCheck, label: "Upcoming appointments", value: data.upcoming.total, to: "/appointments?status=CONFIRMED" },
          { icon: CalendarDays, label: "Open slots · next 30 days", value: openSlots, to: "/availability" }].map(({ icon: Icon, label, value, to, tone }) =>
          <Link className={`dl-stat${tone ? ` dl-stat-${tone}` : ""}`} to={to} key={label}><Icon size={20} aria-hidden="true" /><strong>{value}</strong><span>{label}</span></Link>)}
      </div>
      <div className="sx-split">
        <div className="sx-grid">
          <section className="sx-card" aria-labelledby="next-heading">
            <div className="sx-card-header"><h2 id="next-heading" className="sx-card-title">Next consultation</h2>{next && <Status value={next.status} />}</div>
            {next ? <div className="dl-next">
              <div className="dl-next-who"><span className="sx-avatar">{initials(patientName(next))}</span><div><p className="sx-row-title">{patientName(next)}</p><p className="sx-row-meta">{when(next)}</p></div></div>
              <dl className="sx-facts"><dt>Consultation</dt><dd>{typeLabel(next)}</dd><dt>Reason</dt><dd>{next.reason || "Not provided"}</dd></dl>
              <div className="sx-actions">
                {canJoin(next) && <Link className="sx-btn sx-btn-primary" to={`/appointments/${next.id}?join=1`}><Video size={16} aria-hidden="true" /> Join video and chat</Link>}
                <Link className="sx-btn sx-btn-secondary" to={`/appointments/${next.id}`}>View details</Link>
                {canJoin(next) && !joinable(next) && <span className="sx-hint">The video room opens 10 minutes before the start.</span>}
              </div>
            </div> : <Empty title="No confirmed consultations ahead" text="Accept booking requests or publish availability so patients can book you." action={<Link className="sx-btn sx-btn-secondary sx-btn-sm" to="/availability">Manage availability</Link>} />}
          </section>
          <section className="sx-card" aria-labelledby="upcoming-heading">
            <div className="sx-card-header"><h2 id="upcoming-heading" className="sx-card-title">Next consultations</h2><Link className="sx-link" to="/calendar">Open calendar</Link></div>
            {upcoming.length ? <div className="sx-list">{upcoming.slice(0, 5).map((a) => <AppointmentRow key={a.id} appointment={a} to={`/appointments/${a.id}`} />)}</div> : <Empty title="Your schedule is clear" text="Publish availability so patients can request a consultation." />}
          </section>
        </div>
        <section className="sx-card" aria-labelledby="requests-heading">
          <div className="sx-card-header"><div><h2 id="requests-heading" className="sx-card-title">Needs your response</h2><p className="sx-card-subtitle">Patients are waiting for you to accept or decline.</p></div><Link className="sx-link" to="/appointments?status=REQUESTED">View requests</Link></div>
          {data.requests.items.length ? <div className="sx-list">{data.requests.items.map((a) => <AppointmentRow key={a.id} appointment={a} to={`/appointments/${a.id}`} />)}</div> : <Empty title="You're all caught up" text="New booking requests will appear here." />}
        </section>
      </div>
    </>}
  </Page>;
}
// The original filter options, shown as tabs.
const APPOINTMENT_TABS = [{ id: "", label: "All appointments" }, { id: "REQUESTED", label: "Needs response" }, { id: "CONFIRMED", label: "Confirmed" }, { id: "COMPLETED", label: "Completed" }, { id: "DECLINED", label: "Declined" }, { id: "CANCELLED", label: "Cancelled" }];
function Appointments({ consultations = false }) {
  const { id } = useParams();
  const writesNotes = getCurrentDoctor()?.professionType === "DOCTOR";
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get("status");
  const [filter, setFilter] = useState(consultations ? "CONFIRMED" : APPOINTMENT_TABS.some((t) => t.id === initialStatus) ? initialStatus : "");
  const [offset, setOffset] = useState(0);
  const resource = useResource((signal) => api.loadAppointments(`limit=20&offset=${offset}${filter ? `&status=${filter}` : ""}`, signal), `${filter}:${offset}`);
  const [selectedId, setSelectedId] = useState(id || "");
  const [operation, setOperation] = useState("");
  const [reason, setReason] = useState("");
  const [callId, setCallId] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const detail = useResource(async (signal) => {
    if (!id) return null;
    return api.loadAppointment(id, signal);
  }, id || "none");
  const navigate = useNavigate();
  const items = resource.data?.items || [];
  const selected = items.find((a) => a.id === (id || selectedId)) || (id ? detail.data : null);
  useEffect(() => { setSelectedId(id || ""); setOperation(""); setNotice(null); setCallId(''); }, [id]);
  // Arriving from "Join" on the dashboard opens the call straight away (consent is still asked in the call dialog).
  const wantsJoin = searchParams.get("join") === "1";
  useEffect(() => { if (wantsJoin && selected && canJoin(selected) && !callId) setCallId(selected.id); }, [wantsJoin, selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Refreshing the gated page unmounts its children; never tear down an active call.
    if (callId) return;
    const timer = setInterval(() => resource.reload(), 30000);
    return () => clearInterval(timer);
  }, [filter, offset, callId]);
  async function act(event) {
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      const body = operation === "decline" || operation === "cancel" ? { reason } : {};
      await api.appointmentAction(selected.id, operation, body);
      setNotice({ tone: "success", text: "Appointment updated. The patient sees the new status in Sabi Health." }); setOperation(""); setReason(""); resource.reload(); detail.reload();
    } catch (error) { setNotice({ tone: "danger", text: error.message }); }
    finally { setBusy(false); }
  }
  const future = selected && new Date(selected.startsAt) > new Date();
  const nextStep = !selected ? "" : selected.status === "REQUESTED" ? (future ? "Accept to confirm the booking, or decline with a reason the patient will see." : "This request's start time has passed, so it can no longer be accepted.")
    : selected.status === "CONFIRMED" ? (joinable(selected) ? "The video room is open." : future ? (selected.consultationType === "VIRTUAL" ? "Join opens the video room from 10 minutes before the start." : "See the patient at your practice at the scheduled time.") : "Mark the consultation completed when you have finished.") : "";
  return <Page title={consultations ? "Consultations" : "Appointments"} description="Respond to booking requests, run consultations and keep each patient's status up to date." resource={resource}>
    <Tabs label="Filter appointments" tabs={APPOINTMENT_TABS.map((t) => ({ ...t, count: t.id === filter && resource.data ? resource.data.total : undefined }))} value={filter} onChange={(value) => { setFilter(value); setOffset(0); setSelectedId(""); if (id) navigate(consultations ? "/consultations" : "/appointments"); }} />
    {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
    <div className="sx-split">
      <section className="sx-card" aria-label="Appointment list">
        {items.length ? <div className="sx-list">{items.map((a) => <AppointmentRow key={a.id} appointment={a} selected={selected?.id === a.id} onClick={() => { if (id) navigate(`/appointments/${a.id}`); setSelectedId(a.id); setOperation(""); setNotice(null); }} />)}</div>
          : <Empty title={filter === "REQUESTED" ? "No requests waiting" : "Nothing here yet"} text={filter === "REQUESTED" ? "New booking requests will appear here as soon as patients send them." : "Appointments in this view will appear here."} />}
        <Pagination offset={offset} total={resource.data?.total || 0} size={20} onChange={setOffset} />
      </section>
      <section className="sx-card dl-detail" aria-label="Appointment details">
        {id && <ResourceStatus resource={detail} />}
        {selected ? <>
          <div className="sx-card-header"><div className="dl-next-who"><span className="sx-avatar">{initials(patientName(selected))}</span><div><h2 className="sx-card-title">{patientName(selected)}</h2><p className="sx-card-subtitle">{weekday(selected.startsAt)} · {time(selected.startsAt)}–{time(selected.endsAt)}</p></div></div><Status value={selected.status} /></div>
          <dl className="sx-facts"><dt>Patient reference</dt><dd>{selected.patient?.patientId || "Not supplied"}</dd><dt>Consultation</dt><dd>{typeLabel(selected)}{selected.dependentId ? " · for a dependant" : ""}</dd><dt>Scheduled for</dt><dd>{date(selected.startsAt)} · {time(selected.startsAt)}–{time(selected.endsAt)}</dd><dt>Reason for visit</dt><dd>{selected.reason || "No reason provided"}</dd>{selected.decisionReason && <><dt>Decision note</dt><dd>{selected.decisionReason}</dd></>}</dl>
          {nextStep && <p className="dl-next-step">{nextStep}</p>}
          <div className="sx-actions">
            {canJoin(selected) && <button type="button" className="sx-btn sx-btn-primary" onClick={() => setCallId(selected.id)}><Video size={16} aria-hidden="true" /> Join video and chat</button>}
            {selected.status === "REQUESTED" && <><button type="button" disabled={busy || !future} className="sx-btn sx-btn-primary" onClick={() => setOperation("confirm")}>Accept request</button><button type="button" disabled={busy} className="sx-btn sx-btn-secondary" onClick={() => setOperation("decline")}>Decline</button></>}
            {selected.status === "CONFIRMED" && !future && <button type="button" disabled={busy} className={`sx-btn ${joinable(selected) ? "sx-btn-secondary" : "sx-btn-primary"}`} onClick={() => setOperation("complete")}>Mark completed</button>}
            {["REQUESTED", "CONFIRMED"].includes(selected.status) && future && <button type="button" disabled={busy} className="sx-btn sx-btn-danger" onClick={() => setOperation("cancel")}>Cancel appointment</button>}
            {writesNotes && ["CONFIRMED", "COMPLETED"].includes(selected.status) && <Link className="sx-btn sx-btn-secondary" to={`/reports/${selected.id}`}><FileText size={16} aria-hidden="true" /> Consultation note</Link>}
          </div>
          {operation && <form className="dl-form dl-confirm" onSubmit={act}>
            <h3>{operation === "complete" ? "Complete this consultation?" : operation === "confirm" ? "Confirm this booking?" : operation === "decline" ? "Decline this request" : "Cancel this appointment"}</h3>
            {["decline", "cancel"].includes(operation) && <div className="sx-field"><label htmlFor="appointment-reason">Reason</label><textarea id="appointment-reason" className="sx-textarea" required maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /><span className="sx-hint">The patient will see this. {300 - reason.length} characters left</span></div>}
            {operation === 'confirm' && selected.consultationType === 'VIRTUAL' && <p className="dl-muted">Sabi prepares a private video room when you or the patient joins. No meeting link is needed.</p>}
            <div className="sx-actions"><button className={`sx-btn ${operation === "cancel" || operation === "decline" ? "sx-btn-danger" : "sx-btn-primary"}`} disabled={busy} aria-busy={busy}>{busy ? "Saving…" : operation === "confirm" ? "Accept and confirm" : operation === "complete" ? "Mark completed" : operation === "decline" ? "Decline request" : "Cancel appointment"}</button><button className="sx-btn sx-btn-ghost" type="button" disabled={busy} onClick={() => setOperation("")}>Back</button></div>
          </form>}
        </> : !id && <Empty title="Select an appointment" text="Choose an appointment to review it, respond to the request or join the consultation." />}
      </section>
    </div>
    {callId && <DailyConsultation key={callId} appointmentId={callId} title="Patient consultation" getConfig={api.videoConfig} joinSession={api.joinVideoSession} checkSession={api.checkVideoSession} onClose={() => setCallId('')} />}
  </Page>;
}
function Pagination({ offset, total, size, onChange }) {
  return total > size ? <nav className="dl-pagination" aria-label="Pages"><button type="button" className="sx-btn sx-btn-secondary sx-btn-sm" disabled={!offset} onClick={() => onChange(Math.max(0, offset - size))}>Previous</button><span>{offset + 1}–{Math.min(offset + size, total)} of {total}</span><button type="button" className="sx-btn sx-btn-secondary sx-btn-sm" disabled={offset + size >= total} onClick={() => onChange(offset + size)}>Next</button></nav> : null;
}
function Calendar() {
  const [day, setDay] = useState(localDay(new Date()));
  const shift = (days) => { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() + days); setDay(localDay(d)); };
  const resource = useResource((signal) => Promise.all([api.loadAppointments("limit=100&offset=0&from=" + encodeURIComponent(new Date(`${day}T00:00:00`).toISOString()), signal), api.loadSlots(signal)]).then(([appointments, slots]) => ({ appointments, slots })), day);
  const bookings = resource.data?.appointments.items.filter((a) => localDay(a.startsAt) === day && !["CANCELLED", "DECLINED"].includes(a.status)) || [];
  const slots = resource.data?.slots.items.filter((s) => localDay(s.startsAt) === day && s.state === "OPEN") || [];
  return <Page title="Calendar" description={`Your day at a glance · times in ${Intl.DateTimeFormat().resolvedOptions().timeZone}`} resource={resource} actions={<Link to="/availability" className="sx-btn sx-btn-secondary">Manage availability</Link>}>
    <div className="dl-daybar"><button type="button" className="sx-btn sx-btn-secondary sx-btn-sm" onClick={() => shift(-1)} aria-label="Previous day">‹</button><div className="sx-field"><label htmlFor="calendar-day" className="sx-sr-only">Choose a date</label><input id="calendar-day" className="sx-input" type="date" required value={day} onChange={(e) => e.target.value && setDay(e.target.value)} /></div><button type="button" className="sx-btn sx-btn-secondary sx-btn-sm" onClick={() => shift(1)} aria-label="Next day">›</button>{day !== localDay(new Date()) && <button type="button" className="sx-btn sx-btn-ghost sx-btn-sm" onClick={() => setDay(localDay(new Date()))}>Today</button>}<strong className="dl-daybar-label">{weekday(`${day}T12:00:00`)}</strong></div>
    <div className="sx-split"><section className="sx-card" aria-labelledby="cal-bookings"><div className="sx-card-header"><h2 id="cal-bookings" className="sx-card-title">Consultations</h2><span className="sx-hint">{bookings.length} booked</span></div>{bookings.length ? <div className="sx-list">{bookings.map((a) => <AppointmentRow key={a.id} appointment={a} to={`/appointments/${a.id}`} />)}</div> : <Empty title="No consultations on this date" text="Confirmed and requested appointments appear here." />}</section>
      <section className="sx-card" aria-labelledby="cal-slots"><div className="sx-card-header"><h2 id="cal-slots" className="sx-card-title">Open consultation slots</h2><span className="sx-hint">{slots.length} bookable</span></div>{slots.length ? <div className="sx-chips">{slots.map((s) => <span className="sx-chip" key={s.id}>{time(s.startsAt)}<small>{s.consultationTypes.map((t) => t === "VIRTUAL" ? "Video" : "In person").join(" · ")}</small></span>)}</div> : <Empty title="No open slots" text="Publish available times from Manage availability." />}</section></div>
  </Page>;
}
function Patients() {
  const [offset, setOffset] = useState(0); const [query, setQuery] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const resource = useResource((signal) => Promise.all([api.loadAppointments(`limit=100&offset=${offset}`, signal), api.loadRelationships(signal)]).then(([appointments, relationships]) => ({ appointments, relationships })), offset);
  const patients = useMemo(() => groupPatients(resource.data?.appointments.items || []), [resource.data]);
  const relationships = resource.data?.relationships || [];
  async function respond(id, action) { setBusy(true); setNotice(""); try { await api.respondToRelationship(id, action); resource.reload(); setNotice("Care request updated."); } catch (error) { setNotice(error.message); } finally { setBusy(false); } }
  return <Page title="Patients" description="Patient identities from your appointments and care relationships." resource={resource}>
    {notice && <div className="dl-notice" role="status">{notice}</div>}
    {relationships.some((r) => r.status === "PENDING") && <section className="dp-panel dl-space"><h2>New care requests</h2>{relationships.filter((r) => r.status === "PENDING").map((r) => <div className="dl-slot" key={r.id}><div><strong>{patients.find((p) => p.userId === r.patientId && !p.dependent)?.name || "Patient care request"}</strong><small>Patient ID: {r.patientId}</small></div><button disabled={busy} className="dp-btn dp-btn-primary dp-btn-sm" onClick={() => respond(r.id, "accept")}>Accept</button><button disabled={busy} className="dp-btn dp-btn-outline dp-btn-sm" onClick={() => respond(r.id, "decline")}>Decline</button></div>)}</section>}
    <section className="dp-panel"><div className="dl-section-heading"><h2>Patients in this appointment page</h2><label className="dl-search"><span className="dl-sr-only">Find patient</span><input type="search" placeholder="Find patient by name or ID" value={query} onChange={(e) => setQuery(e.target.value)} /></label></div><div className="dl-list">{patients.filter((p) => `${p.name} ${p.patientId || ""}`.toLowerCase().includes(query.toLowerCase())).map((p) => <div className="dl-slot" key={p.id}><span className="dl-avatar"><Users size={20} /></span><div className="dl-card-main"><h3>{p.name}</h3><p>{p.patientId || "Patient reference unavailable"}{p.dependent ? " · Dependent" : ""}</p><small>{p.appointments.length} appointments on this page</small></div><Link className="dp-btn dp-btn-outline dp-btn-sm" to={`/appointments/${p.appointments[0].id}`}>View appointment</Link></div>)}</div>{!patients.length && <Empty title="Your patient list is empty" text="Patients appear after booking a consultation with you." />}<Pagination offset={offset} total={resource.data?.appointments.total || 0} size={100} onChange={setOffset} /></section>
  </Page>;
}
function Profile() {
  const resource = useResource(api.loadPractice); const [form, setForm] = useState(null); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (resource.data) setForm({ practiceName: resource.data.practiceName || "", bio: resource.data.bio || "", practiceAddress: resource.data.practiceAddress || "", yearsOfExperience: resource.data.yearsOfExperience ?? "", fee: resource.data.consultationFeeMinor === null ? "" : String((resource.data.consultationFeeMinor || 0) / 100), virtual: resource.data.consultationTypes.includes("VIRTUAL"), physical: resource.data.consultationTypes.includes("IN_PERSON") }); }, [resource.data]);
  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  async function save(event) { event.preventDefault(); setBusy(true); setNotice(""); try { await api.savePractice({ practiceName: form.practiceName, bio: form.bio || null, practiceAddress: form.practiceAddress || null, yearsOfExperience: form.yearsOfExperience === "" ? null : Number(form.yearsOfExperience), consultationFeeMinor: form.fee === "" ? null : Math.round(Number(form.fee) * 100), consultationTypes: [...(form.virtual ? ["VIRTUAL"] : []), ...(form.physical ? ["IN_PERSON"] : [])] }); setNotice("Practice profile saved. Your directory listing uses these details."); resource.reload(); } catch (error) { setNotice(error.message); } finally { setBusy(false); } }
  return <Page title="Your practice profile" description="Manage the details patients see when choosing a doctor." resource={resource}>
    {notice && <div className="dl-notice" role="status">{notice}</div>}{form && <div className="dl-columns"><section className="dp-panel"><span className="dl-profile-avatar"><Stethoscope size={36} /></span><h2>{getCurrentDoctor().name}</h2><p>{resource.data.specialty || "Doctor"}</p><span className="dl-status dl-status-confirmed"><ShieldCheck size={14} /> Verified practitioner</span><p className="dl-muted">{getCurrentDoctor().email}</p></section><section className="dp-panel"><h2>Practice details</h2><form className="dl-form" onSubmit={save}><label>Practice name<input required maxLength={160} value={form.practiceName} onChange={(e) => update("practiceName", e.target.value)} /></label><label>Professional biography<textarea maxLength={2000} value={form.bio} onChange={(e) => update("bio", e.target.value)} /></label><label>Practice address<input maxLength={300} value={form.practiceAddress} onChange={(e) => update("practiceAddress", e.target.value)} /></label><div className="dl-form-row"><label>Years of experience<input type="number" min="0" max="70" step="1" value={form.yearsOfExperience} onChange={(e) => update("yearsOfExperience", e.target.value)} /></label><label>Consultation fee (₦)<input type="number" min="0" max="1000000" step="0.01" value={form.fee} onChange={(e) => update("fee", e.target.value)} /></label></div><div className="dl-checks"><label><input type="checkbox" checked={form.virtual} onChange={(e) => update("virtual", e.target.checked)} /> Virtual</label><label><input type="checkbox" checked={form.physical} onChange={(e) => update("physical", e.target.checked)} /> In person</label></div><button className="dp-btn dp-btn-primary" disabled={busy}>{busy ? "Saving…" : "Save practice profile"}</button></form></section></div>}
  </Page>;
}
function Notifications() {
  const [page, setPage] = useState(1); const [notice, setNotice] = useState("");
  const resource = useResource((signal) => api.loadNotifications(page, signal), page);
  async function mark(id) { try { await api.markNotificationRead(id); resource.reload(); } catch (error) { setNotice(error.message); } }
  return <Page title="Notifications" description="Updates sent to your Sabi account." resource={resource}>{notice && <div role="status" className="dl-notice">{notice}</div>}<section className="dp-panel">{resource.data?.items.length ? resource.data.items.map((n) => <article className="dl-slot" key={n.id}><div className="dl-card-main"><h3>{n.title}</h3><p>{n.message || n.body}</p><small>{date(n.createdAt)}</small></div>{!n.isRead && <button className="dp-btn dp-btn-outline dp-btn-sm" onClick={() => mark(n.id)}>Mark read</button>}</article>) : <Empty title="You're up to date" text="Your account notifications will appear here." />}<Pagination offset={(page - 1) * 20} size={20} total={resource.data?.total || 0} onChange={(offset) => setPage(offset / 20 + 1)} /></section></Page>;
}
const FREQUENCIES = ["ONCE_DAILY", "TWICE_DAILY", "THREE_TIMES_DAILY", "FOUR_TIMES_DAILY", "EVERY_4_HOURS", "EVERY_6_HOURS", "EVERY_8_HOURS", "EVERY_12_HOURS", "AS_NEEDED", "OTHER"];
const ROUTES = ["ORAL", "TOPICAL", "INHALATION", "SUBCUTANEOUS", "INTRAMUSCULAR", "INTRAVENOUS", "RECTAL", "OPHTHALMIC", "OTIC", "NASAL", "OTHER"];
const blankMedication = () => ({ medicationName: "", dosage: "", frequency: "ONCE_DAILY", route: "ORAL", duration: "", quantity: 1, indication: "" });
const humanize = (value) => value.replaceAll("_", " ").toLowerCase();
function Prescriptions() {
  const [page, setPage] = useState(1);
  const resource = useResource((signal) => Promise.all([api.loadPrescriptions(page, signal), api.loadRelationships(signal), api.loadAppointments("limit=100&offset=0", signal)]).then(([prescriptions, relationships, appointments]) => ({ prescriptions, relationships, appointments })), page);
  const [form, setForm] = useState(null); const [selected, setSelected] = useState(null); const [attest, setAttest] = useState(false); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");
  const patients = groupPatients(resource.data?.appointments.items || []);
  const activeRelationships = resource.data?.relationships.filter((r) => r.status === "ACTIVE") || [];
  const patientLabel = (userId) => patients.find((p) => p.userId === userId && !p.dependent)?.name || `Patient · ${userId}`;
  function edit(rx) {
    setForm({ id: rx?.id, patientId: rx?.patientId || "", instructions: rx?.instructions || "", items: rx ? rx.items.map(({ medicationName, dosage, frequency, route, duration, quantity, indication }) => ({ medicationName, dosage, frequency, route, duration, quantity, indication })) : [blankMedication()] });
    setSelected(null); setNotice("");
  }
  function updateMedication(index, key, value) { setForm((f) => ({ ...f, items: f.items.map((item, i) => i === index ? { ...item, [key]: value } : item) })); }
  async function save(event) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const body = { ...(!form.id ? { patientId: form.patientId } : {}), items: form.items.map((item) => ({ ...item, quantity: Number(item.quantity) })), instructions: form.instructions };
      const rx = await api.savePrescription(body, form.id); setForm(null); setSelected(rx); setNotice("Draft saved. Review it before issuing it to the patient."); resource.reload();
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  }
  async function issue() {
    setBusy(true); setNotice("");
    try { await api.issuePrescription(selected.id); setSelected(null); setAttest(false); setNotice("Prescription issued. The patient can now see it in Sabi Health."); resource.reload(); }
    catch (error) { setNotice(error.message); } finally { setBusy(false); }
  }
  return <Page title="Prescriptions" description="Create and issue prescriptions for patients with an active care relationship." resource={resource} actions={<button disabled={busy || !activeRelationships.length} className="dp-btn dp-btn-primary" onClick={() => edit(null)}><FileText size={16} /> New prescription</button>}>
    {notice && <div className="dl-notice" role="status">{notice}</div>}
    {!activeRelationships.length && <div className="dl-notice">Accept a patient's care request in Patients before prescribing for them.</div>}
    {form ? <section className="dp-panel"><div className="dl-section-heading"><h2>{form.id ? "Edit prescription draft" : "New prescription draft"}</h2><button className="dp-btn dp-btn-outline dp-btn-sm" disabled={busy} onClick={() => setForm(null)}>Close draft</button></div><form className="dl-form" onSubmit={save}><label>Patient<select required disabled={Boolean(form.id)} value={form.patientId} onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))}><option value="">Select a patient with active care permission</option>{activeRelationships.map((r) => <option key={r.id} value={r.patientId}>{patientLabel(r.patientId)}</option>)}</select></label><p className="dl-muted">This prescribing flow supports the account holder. Dependent prescribing requires a separate patient record workflow.</p>
      {form.items.map((item, index) => <fieldset className="dl-medication" key={index}><legend>Medication {index + 1}</legend><div className="dl-form-row"><label>Medication name<input required minLength={2} maxLength={120} value={item.medicationName} onChange={(e) => updateMedication(index, "medicationName", e.target.value)} /></label><label>Dosage<input required maxLength={64} value={item.dosage} onChange={(e) => updateMedication(index, "dosage", e.target.value)} /></label><label>Frequency<select value={item.frequency} onChange={(e) => updateMedication(index, "frequency", e.target.value)}>{FREQUENCIES.map((f) => <option key={f} value={f}>{humanize(f)}</option>)}</select></label><label>Route<select value={item.route} onChange={(e) => updateMedication(index, "route", e.target.value)}>{ROUTES.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}</select></label><label>Duration<input required minLength={2} maxLength={64} value={item.duration} onChange={(e) => updateMedication(index, "duration", e.target.value)} placeholder="e.g. 7 days" /></label><label>Quantity<input required type="number" min="1" max="10000" step="1" value={item.quantity} onChange={(e) => updateMedication(index, "quantity", e.target.value)} /></label></div><label>Indication<input required minLength={2} maxLength={240} value={item.indication} onChange={(e) => updateMedication(index, "indication", e.target.value)} /></label>{form.items.length > 1 && <button type="button" className="dp-btn dp-btn-outline dp-btn-sm" onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }))}>Remove medication</button>}</fieldset>)}
      <button className="dp-btn dp-btn-outline" type="button" disabled={form.items.length >= 20} onClick={() => setForm((f) => ({ ...f, items: [...f.items, blankMedication()] }))}>Add medication</button><label>Patient instructions<textarea maxLength={2000} value={form.instructions} onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))} /></label><button className="dp-btn dp-btn-primary" disabled={busy}>{busy ? "Saving…" : "Save draft for review"}</button>
    </form></section> : <div className="dl-columns"><section className="dp-panel"><h2>Your prescriptions</h2>{resource.data?.prescriptions.items.length ? resource.data.prescriptions.items.map((rx) => <button className={`dl-appointment-card ${selected?.id === rx.id ? "is-selected" : ""}`} key={rx.id} onClick={() => { setSelected(rx); setAttest(false); }}><div className="dl-card-main"><h3>{patientLabel(rx.patientId)}</h3><p>{rx.reference}</p><small>{date(rx.createdAt)} · {rx.items.length} medications</small></div><Status value={rx.status} /></button>) : <Empty title="No prescriptions yet" text="Create a draft for a patient after accepting their care request." />}<Pagination offset={(page - 1) * 20} size={20} total={resource.data?.prescriptions.total || 0} onChange={(offset) => setPage(offset / 20 + 1)} /></section><section className="dp-panel">{selected ? <><div className="dl-section-heading"><h2>{patientLabel(selected.patientId)}</h2><Status value={selected.status} /></div><p className="dl-muted">{selected.reference}</p>{selected.items.map((item) => <div className="dl-medication" key={item.id || item.medicationName}><h3>{item.medicationName}</h3><p>{item.dosage} · {humanize(item.frequency)} · {humanize(item.route)}</p><p>{item.duration} · Quantity: {item.quantity}</p><small>Indication: {item.indication}</small></div>)}<p>{selected.instructions}</p>{selected.status === "DRAFT" && <><div className="dl-checks dl-space"><label><input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} /> I have reviewed the patient, medication, dosage and instructions.</label></div><div className="dl-actions dl-space"><button className="dp-btn dp-btn-primary" disabled={!attest || busy} onClick={issue}>{busy ? "Issuing…" : "Issue to patient"}</button><button className="dp-btn dp-btn-outline" disabled={busy} onClick={() => edit(selected)}>Edit draft</button></div></>}{selected.status === "ISSUED" && <p className="dl-muted">Issued {date(selected.issuedAt)}. This prescription is locked after issuing.</p>}</> : <Empty title="Review a prescription" text="Select a draft or issued prescription to see its details." />}</section></div>}
  </Page>;
}
function Settings() {
  const resource = useResource((signal) => Promise.all([api.loadSessions(signal), api.loadMfa(signal)]).then(([sessions, mfa]) => ({ sessions, mfa })));
  const navigate = useNavigate(); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  async function revoke(id) { setBusy(true); try { await api.revokeSession(id); resource.reload(); } catch (error) { setNotice(error.message); } finally { setBusy(false); } }
  async function logout() { setBusy(true); try { await api.logoutEverywhere(); signOutDoctor(); navigate("/login", { replace: true }); } catch (error) { setNotice(error.message); } finally { setBusy(false); } }
  return <Page title="Account settings" description="Manage your Sabi Identity security and active sessions." resource={resource}>{notice && <div className="dl-notice" role="status">{notice}</div>}<div className="dl-columns"><section className="dp-panel"><h2>Account & security</h2><p>{getCurrentDoctor().email}</p><p className="dl-muted">Manage your authenticator and recovery codes through Sabi Identity.</p><div className="dl-actions"><a className="dp-btn dp-btn-primary" href={`${IDENTITY_UI_URL}/identity/mfa`}><ShieldCheck size={16} /> Manage authenticator</a><Link className="dp-btn dp-btn-outline" to="/forgot-password">Reset password</Link></div></section><section className="dp-panel"><div className="dl-section-heading"><h2>Active sessions</h2><button className="dp-btn dp-btn-danger dp-btn-sm" disabled={busy} onClick={logout}>Log out everywhere</button></div>{resource.data?.sessions.map((s) => <div className="dl-slot" key={s.id}><div className="dl-card-main"><h3>{s.device?.label || "Browser session"}</h3><p>Last used {date(s.lastUsedAt)}</p><small>{s.current ? "Current session" : "Other device"}</small></div>{!s.current && <button className="dp-btn dp-btn-outline dp-btn-sm" disabled={busy} onClick={() => revoke(s.id)}>Revoke</button>}</div>)}</section></div></Page>;
}
// Consultation notes: the doctor's private record plus the visit summary the patient receives when signed.
const BLANK_NOTE = { clinical: { presentingComplaint: "", history: "", findings: "", assessment: "", plan: "" }, patient: { summary: "", advice: "", warningSigns: "", followUp: { needed: false, timeframe: "", instructions: "" } } };
const CLINICAL_FIELDS = [["presentingComplaint", "Presenting complaint", 2000], ["history", "History", 4000], ["findings", "Findings and observations", 4000], ["assessment", "Assessment", 2000], ["plan", "Plan", 4000]];
const SUMMARY_FIELDS = [["summary", "What we discussed", 3000], ["advice", "Advice and next steps", 3000], ["warningSigns", "When to seek urgent care", 1500]];
const noteWho = (a) => a.forName ? `${a.patient.name || "Patient"} · for ${a.forName}` : a.patient.name || "Patient";
function NoteStatus({ note }) {
  if (!note?.signedVersion) return <span className="dl-status dl-status-requested">Draft</span>;
  return <span className="dl-status dl-status-confirmed">{note.hasUnsignedChanges ? `Signed v${note.signedVersion} · unsigned changes` : `Signed v${note.signedVersion}`}</span>;
}
function ConsultationReports() {
  const [offset, setOffset] = useState(0);
  const resource = useResource((signal) => api.loadConsultationNotes(offset, signal), offset);
  const data = resource.data;
  return <Page title="Reports" description="Consultation notes and the visit summaries your patients receive." resource={resource}>
    {data && <div className="dl-columns"><section className="dp-panel"><h2>Waiting for your note</h2>{data.awaiting.length ? <div className="dl-list">{data.awaiting.map((a) => <Link key={a.appointmentId} to={`/reports/${a.appointmentId}`} className="dl-appointment-card"><div className="dl-card-main"><h3>{noteWho(a)}</h3><p>{date(a.startsAt)} · {time(a.startsAt)}</p><small>Completed · no signed note yet</small></div><span className="dl-status dl-status-requested">Write note</span></Link>)}</div> : <Empty title="You're up to date" text="Completed consultations without a signed note appear here." />}</section>
      <section className="dp-panel"><h2>Your consultation notes</h2>{data.items.length ? <div className="dl-list">{data.items.map((n) => <Link key={n.appointmentId} to={`/reports/${n.appointmentId}`} className="dl-appointment-card"><div className="dl-card-main"><h3>{noteWho(n)}</h3><p>{date(n.startsAt)} · {time(n.startsAt)}</p><small>Last edited {date(n.updatedAt)}</small></div><NoteStatus note={n} /></Link>)}</div> : <Empty title="No notes yet" text="Open a confirmed or completed appointment and choose Consultation note." />}<Pagination offset={offset} total={data.total} size={20} onChange={setOffset} /></section></div>}
  </Page>;
}
function ConsultationNoteEditor() {
  const { appointmentId } = useParams();
  const resource = useResource((signal) => api.loadConsultationNote(appointmentId, signal), appointmentId);
  const [saved, setSaved] = useState(null); const [form, setForm] = useState(null); const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");
  useEffect(() => { if (resource.data) { setSaved(resource.data); setForm(resource.data.note?.draft || BLANK_NOTE); } }, [resource.data]);
  const dirty = Boolean(form && saved) && JSON.stringify(form) !== JSON.stringify(saved.note?.draft || BLANK_NOTE);
  // Warn before leaving the page with unsaved clinical text.
  useEffect(() => { if (!dirty) return undefined; const warn = (event) => { event.preventDefault(); event.returnValue = ""; }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
  const setClinical = (key, value) => setForm((f) => ({ ...f, clinical: { ...f.clinical, [key]: value } }));
  const setSummary = (key, value) => setForm((f) => ({ ...f, patient: { ...f.patient, [key]: value } }));
  const setFollowUp = (key, value) => setForm((f) => ({ ...f, patient: { ...f.patient, followUp: { ...f.patient.followUp, [key]: value } } }));
  async function persist() { const next = await api.saveConsultationNote(appointmentId, { ...(saved.note ? { revision: saved.note.revision } : {}), content: form }); setSaved(next); setForm(next.note.draft); return next; }
  async function run(work, message) { setBusy(true); setNotice(""); try { await work(); setNotice(message); } catch (error) { setNotice(error.message); } finally { setBusy(false); } }
  const amending = Boolean(saved?.note?.signedVersion);
  function save(event) { event.preventDefault(); run(persist, amending ? "Changes saved. The patient still sees the signed version until you sign the amendment." : "Draft saved. Only you can see it until you sign."); }
  function sign() {
    run(async () => {
      const current = dirty || !saved.note ? await persist() : saved;
      const next = await api.signConsultationNote(appointmentId, { revision: current.note.revision, ...(amending ? { amendmentReason: reason } : {}) });
      setSaved(next); setForm(next.note.draft); setReason("");
    }, amending ? "Amendment signed. The patient sees the updated visit summary." : "Note signed. The patient can now read the visit summary.");
  }
  const appointment = saved?.appointment; const note = saved?.note;
  return <Page title="Consultation note" description={appointment ? `${appointment.dependent ? `${appointment.dependent.name} (via ${appointment.patient.name || "patient"})` : appointment.patient.name || "Patient"} · ${date(appointment.startsAt)} · ${time(appointment.startsAt)}` : "The record of this consultation."} resource={resource} actions={<Link className="dp-btn dp-btn-outline dp-btn-sm" to="/reports">All notes</Link>}>
    {notice && <div className="dl-notice" role="status">{notice}</div>}
    {form && appointment && <div className="dl-columns"><section className="dp-panel"><div className="dl-section-heading"><h2>Clinical record</h2>{note ? <NoteStatus note={note} /> : <span className="dl-status dl-status-requested">New</span>}</div>
      <form className="dl-form" onSubmit={save}>
        <fieldset className="dl-medication" disabled={busy}><legend>Private to you</legend>{CLINICAL_FIELDS.map(([key, label, max]) => <label key={key}>{label}<textarea maxLength={max} value={form.clinical[key]} onChange={(e) => setClinical(key, e.target.value)} /></label>)}</fieldset>
        <fieldset className="dl-medication" disabled={busy}><legend>Visit summary for the patient</legend><p className="dl-muted">Shared with the patient when you sign. Write it in plain language.</p>{SUMMARY_FIELDS.map(([key, label, max]) => <label key={key}>{label}<textarea maxLength={max} value={form.patient[key]} onChange={(e) => setSummary(key, e.target.value)} /></label>)}
          <div className="dl-checks"><label><input type="checkbox" checked={form.patient.followUp.needed} onChange={(e) => setFollowUp("needed", e.target.checked)} /> Recommend a follow-up</label></div>
          {form.patient.followUp.needed && <div className="dl-form-row"><label>When<input maxLength={120} placeholder="e.g. In two weeks" value={form.patient.followUp.timeframe} onChange={(e) => setFollowUp("timeframe", e.target.value)} /></label><label>Follow-up instructions<input maxLength={1000} value={form.patient.followUp.instructions} onChange={(e) => setFollowUp("instructions", e.target.value)} /></label></div>}
        </fieldset>
        {amending && <label>Reason for changing the signed note<textarea maxLength={500} placeholder="e.g. Corrected the advice on fluids" value={reason} onChange={(e) => setReason(e.target.value)} /></label>}
        <div className="dl-actions"><button className="dp-btn dp-btn-outline" disabled={busy || !dirty}>{busy ? "Saving…" : "Save draft"}</button><button type="button" className="dp-btn dp-btn-primary" disabled={busy || !saved.canSign || (amending && reason.trim().length < 5)} onClick={sign}>{amending ? "Sign amendment" : "Sign and share with patient"}</button></div>
        {!saved.canSign && <p className="dl-muted">You can save drafts now. Signing opens once you mark the consultation completed in <Link to={`/appointments/${appointment.id}`}>Appointments</Link>.</p>}
        {amending && reason.trim().length < 5 && <p className="dl-muted">Give a reason (at least 5 characters) to sign an amendment. Earlier signed versions are kept.</p>}
      </form></section>
      <section className="dp-panel"><h2>Consultation</h2><dl className="dl-facts"><dt>Patient</dt><dd>{appointment.patient.name || "Patient"}{appointment.patient.patientId ? ` · ${appointment.patient.patientId}` : ""}</dd>{appointment.dependent && <><dt>Consultation for</dt><dd>{appointment.dependent.name}</dd></>}<dt>Scheduled for</dt><dd>{date(appointment.startsAt)} · {time(appointment.startsAt)}–{time(appointment.endsAt)}</dd><dt>Consultation</dt><dd>{appointment.consultationType === "VIRTUAL" ? "Virtual" : "In person"}</dd><dt>Status</dt><dd><Status value={appointment.status} /></dd><dt>Reason for visit</dt><dd>{appointment.reason || "No reason provided"}</dd></dl>
        {note?.versions.length > 0 && <><h3>Signed versions</h3><div className="dl-list">{note.versions.map((v) => <div className="dl-slot" key={v.number}><div className="dl-card-main"><h3>Version {v.number}</h3><p>{date(v.signedAt)} · {time(v.signedAt)}</p>{v.amendmentReason && <small>Reason: {v.amendmentReason}</small>}</div></div>)}</div></>}
        <h3 className="dl-space">Your earlier notes for this patient</h3>{saved.previous.length ? <div className="dl-list">{saved.previous.map((p) => <Link className="dl-appointment-card" key={p.appointmentId} to={`/reports/${p.appointmentId}`}><div className="dl-card-main"><h3>{date(p.startsAt)}</h3><p>{p.assessment}</p><small>{p.plan}</small></div></Link>)}</div> : <p className="dl-muted">No earlier signed notes from you for this patient.</p>}
      </section></div>}
  </Page>;
}
function PendingFeature({ title, text }) { return <Page title={title} description={text}><section className="dp-panel"><Empty title={`${title} is being connected`} text="You can manage appointments, publish availability, and update your practice profile now." /><div className="dl-actions"><Link to="/appointments" className="dp-btn dp-btn-primary">Open appointments</Link><Link to="/dashboard" className="dp-btn dp-btn-outline">Back to dashboard</Link></div></section></Page>; }
export default function LiveDoctorWorkspace() {
  const professional=getCurrentDoctor();
  const clinical=professional?.isDemo || professional?.professionType==='DOCTOR';
  return <Routes>
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/appointments" element={<Appointments />} />
    <Route path="/appointments/:id" element={<Appointments />} />
    <Route path="/consultations" element={<Appointments consultations />} />
    <Route path="/calendar" element={<Calendar />} />
    <Route path="/availability" element={<PortalLayout topbarProps={{title:'Sabi Health · Professional Portal'}}><ProfessionalAvailability /></PortalLayout>} />
    <Route path="/patients" element={clinical ? <Patients /> : <Navigate to="/care-workspace" replace />} />
    <Route path="/care-workspace" element={!clinical ? <PortalLayout topbarProps={{title:'Sabi Health · Professional Portal'}}><ProfessionalCareWorkspace /></PortalLayout> : <Navigate to="/patients" replace />} />
    <Route path="/profile" element={<Profile />} />
    <Route path="/settings" element={<Settings />} />
    <Route path="/notifications" element={<Notifications />} />
    <Route path="/prescriptions" element={clinical ? <Prescriptions /> : <Navigate to="/care-workspace" replace />} />
    <Route path="/reports" element={clinical ? <ConsultationReports /> : <PendingFeature title="Reports" text="Consultation reports and lab orders." />} />
    <Route path="/reports/:appointmentId" element={clinical ? <ConsultationNoteEditor /> : <Navigate to="/reports" replace />} />
    {[{ path: "messages", title: "Messages", text: "Patient conversations and care updates." }, { path: "hospital-workspace", title: "Hospital workspace", text: "Your hospital affiliations and assigned patient queues." }, { path: "earnings", title: "Earnings", text: "Consultation earnings and payout history." }, { path: "reviews", title: "Reviews", text: "Patient feedback on your care." }].map((feature) => <Route key={feature.path} path={`/${feature.path}`} element={<PendingFeature {...feature} />} />)}
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>;
}

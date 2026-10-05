import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { CalendarDays, CalendarCheck, ClipboardList, Clock, FileText, RefreshCw, ShieldCheck, Stethoscope, Users, Video } from "lucide-react";
import PortalLayout from "../components/PortalLayout";
import { getCurrentDoctor, signOutDoctor } from "../store/doctorSession";
import { IDENTITY_UI_URL } from "../services/runtime";
import * as api from "./doctorApi";
import { groupPatients, localDay, safeMeetingUrl, statusLabel } from "./doctorData";
import "./LiveDoctorWorkspace.css";

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
const patientName = (a) => a.dependent?.name || a.patient?.name || "Patient";
function Status({ value }) { return <span className={`dl-status dl-status-${value?.toLowerCase()}`}>{statusLabel(value)}</span>; }
function Empty({ title, text }) { return <div className="dl-empty"><ClipboardList size={30} /><h3>{title}</h3><p>{text}</p></div>; }
function ResourceStatus({ resource }) {
  if (resource.loading && !resource.data) return <div className="dl-loading" role="status"><span className="dl-spinner" /> Loading your workspace…</div>;
  if (resource.error) return <div className="dl-error" role="alert"><p>{resource.error}</p><button className="dp-btn dp-btn-outline dp-btn-sm" onClick={resource.reload}>Try again</button></div>;
  return null;
}
function Page({ title, description, resource, actions, children }) {
  return <PortalLayout topbarProps={{ title: "Sabi Health · Doctor Portal" }}><div className="dl-page">
    <header className="dl-heading"><div><span className="dl-eyebrow">YOUR PRACTICE, CONNECTED</span><h1>{title}</h1><p>{description}</p></div><div className="dl-actions">{actions}{resource && <button className="dp-btn dp-btn-outline dp-btn-sm" disabled={resource.loading} onClick={resource.reload}><RefreshCw size={15} /> Refresh</button>}</div></header>
    {resource && <ResourceStatus resource={resource} />}{(!resource || !resource.loading && !resource.error) && children}
  </div></PortalLayout>;
}
function AppointmentCards({ items }) {
  return <div className="dl-list">{items.map((a) => <Link key={a.id} to={`/appointments/${a.id}`} className="dl-appointment-card">
    <span className="dl-avatar">{patientName(a).split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
    <div className="dl-card-main"><h3>{patientName(a)}</h3><p>{date(a.startsAt)} · {time(a.startsAt)}–{time(a.endsAt)}</p><small>{a.consultationType === "VIRTUAL" ? "Virtual consultation" : "In-person consultation"}{a.dependentId ? " · Dependent" : ""}</small></div>
    <Status value={a.status} />
  </Link>)}</div>;
}
function Dashboard() {
  const doctor = getCurrentDoctor();
  const resource = useResource((signal) => Promise.all([
    api.loadAppointments("limit=100&offset=0&status=CONFIRMED&from=" + encodeURIComponent(new Date().toISOString()), signal),
    api.loadAppointments("limit=5&offset=0&status=REQUESTED", signal),
    api.loadSlots(signal),
  ]).then(([upcoming, requests, slots]) => ({ upcoming, requests, slots })));
  const data = resource.data;
  return <Page title={`Welcome, ${doctor.name}`} description={new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" })} resource={resource} actions={<Link className="dp-btn dp-btn-primary" to="/availability"><CalendarDays size={16} /> Publish availability</Link>}>
    {data && <><div className="dl-stats">
      {[{ icon: CalendarCheck, label: "Upcoming appointments", value: data.upcoming.total }, { icon: Clock, label: "Awaiting your response", value: data.requests.total }, { icon: CalendarDays, label: "Open slots · next 30 days", value: data.slots.items.filter((s) => s.state === "OPEN" && new Date(s.startsAt) > new Date()).length }].map(({ icon: Icon, label, value }) => <div className="dl-stat" key={label}><Icon size={21} /><strong>{value}</strong><span>{label}</span></div>)}
    </div><div className="dl-columns"><section className="dp-panel"><div className="dl-section-heading"><h2>Needs your response</h2><Link to="/appointments?status=REQUESTED">View requests</Link></div>{data.requests.items.length ? <AppointmentCards items={data.requests.items} /> : <Empty title="You're all caught up" text="New patient booking requests will appear here." />}</section><section className="dp-panel"><div className="dl-section-heading"><h2>Next consultations</h2><Link to="/calendar">Open calendar</Link></div>{data.upcoming.items.length ? <AppointmentCards items={data.upcoming.items.slice(0, 5)} /> : <Empty title="Your schedule is clear" text="Publish availability so patients can request a consultation." />}</section></div></>}
  </Page>;
}
function Appointments({ consultations = false }) {
  const { id } = useParams();
  const initialStatus = new URLSearchParams(window.location.search).get("status") || "";
  const [filter, setFilter] = useState(consultations ? "CONFIRMED" : initialStatus);
  const [offset, setOffset] = useState(0);
  const resource = useResource((signal) => api.loadAppointments(`limit=20&offset=${offset}${filter ? `&status=${filter}` : ""}`, signal), `${filter}:${offset}`);
  const [selectedId, setSelectedId] = useState(id || "");
  const [operation, setOperation] = useState("");
  const [reason, setReason] = useState("");
  const [meeting, setMeeting] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const detail = useResource(async (signal) => {
    if (!id) return null;
    return api.loadAppointment(id, signal);
  }, id || "none");
  const navigate = useNavigate();
  const items = resource.data?.items || [];
  const selected = items.find((a) => a.id === (id || selectedId)) || (id ? detail.data : null);
  useEffect(() => { setSelectedId(id || ""); setOperation(""); setNotice(""); }, [id]);
  useEffect(() => {
    const timer = setInterval(() => resource.reload(), 30000);
    return () => clearInterval(timer);
  }, [filter, offset]);
  async function act(event) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const body = operation === "decline" || operation === "cancel" ? { reason } : operation === "meeting-link" ? { meetingUrl: meeting || null } : operation === "confirm" && meeting ? { meetingUrl: meeting } : {};
      await api.appointmentAction(selected.id, operation, body);
      setNotice("Appointment updated. The patient sees the updated status in Sabi Health."); setOperation(""); setReason(""); setMeeting(""); resource.reload(); detail.reload();
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }
  return <Page title={consultations ? "Consultations" : "Appointments"} description="Manage booking requests and consultation status." resource={resource}>
    <div className="dl-filters"><label>Show <select value={filter} onChange={(e) => { setFilter(e.target.value); setOffset(0); setSelectedId(""); }}><option value="">All appointments</option>{["REQUESTED", "CONFIRMED", "COMPLETED", "DECLINED", "CANCELLED"].map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</select></label></div>
    {notice && <div className="dl-notice" role="status">{notice}</div>}
    <div className="dl-columns"><section className="dp-panel">
      {items.length ? <div className="dl-list">{items.map((a) => <button key={a.id} className={`dl-appointment-card ${selected?.id === a.id ? "is-selected" : ""}`} onClick={() => { if (id) navigate(`/appointments/${a.id}`); setSelectedId(a.id); setOperation(""); setNotice(""); }}><div className="dl-card-main"><h3>{patientName(a)}</h3><p>{date(a.startsAt)} · {time(a.startsAt)}</p><small>{a.consultationType === "VIRTUAL" ? "Virtual" : "In person"}</small></div><Status value={a.status} /></button>)}</div> : <Empty title="No appointments here yet" text="Patient bookings appear here as soon as they are requested." />}
      <Pagination offset={offset} total={resource.data?.total || 0} size={20} onChange={setOffset} />
    </section><section className="dp-panel">
      {id && <ResourceStatus resource={detail} />}
      {selected ? <><div className="dl-section-heading"><h2>{patientName(selected)}</h2><Status value={selected.status} /></div><dl className="dl-facts"><dt>Patient reference</dt><dd>{selected.patient?.patientId || "Not supplied"}</dd><dt>Consultation</dt><dd>{selected.consultationType === "VIRTUAL" ? "Virtual" : "In person"}</dd><dt>Scheduled for</dt><dd>{date(selected.startsAt)} · {time(selected.startsAt)}–{time(selected.endsAt)}</dd><dt>Reason for visit</dt><dd>{selected.reason || "No reason provided"}</dd>{selected.decisionReason && <><dt>Decision note</dt><dd>{selected.decisionReason}</dd></>}</dl>
        {selected.status === "CONFIRMED" && safeMeetingUrl(selected.meetingUrl) && <a className="dp-btn dp-btn-primary" href={safeMeetingUrl(selected.meetingUrl)} target="_blank" rel="noreferrer"><Video size={16} /> Join consultation</a>}
        <div className="dl-actions dl-space">
          {selected.status === "REQUESTED" && <><button disabled={busy || new Date(selected.startsAt) <= new Date()} className="dp-btn dp-btn-primary" onClick={() => setOperation("confirm")}>Accept request</button><button disabled={busy} className="dp-btn dp-btn-outline" onClick={() => setOperation("decline")}>Decline</button></>}
          {selected.status === "CONFIRMED" && selected.consultationType === "VIRTUAL" && <button disabled={busy} className="dp-btn dp-btn-outline" onClick={() => { setOperation("meeting-link"); setMeeting(selected.meetingUrl || ""); }}>Update meeting link</button>}
          {selected.status === "CONFIRMED" && new Date(selected.startsAt) <= new Date() && <button disabled={busy} className="dp-btn dp-btn-primary" onClick={() => setOperation("complete")}>Mark completed</button>}
          {["REQUESTED", "CONFIRMED"].includes(selected.status) && new Date(selected.startsAt) > new Date() && <button disabled={busy} className="dp-btn dp-btn-danger" onClick={() => setOperation("cancel")}>Cancel appointment</button>}
        </div>
        {operation && <form className="dl-form dl-space" onSubmit={act}><h3>{operation === "complete" ? "Complete this consultation?" : operation === "confirm" ? "Confirm booking" : operation === "meeting-link" ? "Meeting link" : "Record your reason"}</h3>{["decline", "cancel"].includes(operation) && <label>Reason<textarea required maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></label>}{["confirm", "meeting-link"].includes(operation) && selected.consultationType === "VIRTUAL" && <label>HTTPS meeting link {operation === "confirm" && "(optional)"}<input type="url" pattern="https://.*" maxLength={500} value={meeting} onChange={(e) => setMeeting(e.target.value)} /></label>}<div className="dl-actions"><button className="dp-btn dp-btn-primary" disabled={busy}>{busy ? "Saving…" : "Confirm"}</button><button className="dp-btn dp-btn-outline" type="button" disabled={busy} onClick={() => setOperation("")}>Back</button></div></form>}
      </> : !id && <Empty title="Select an appointment" text="Review its details, respond to the request, or add a meeting link." />}
    </section></div>
  </Page>;
}
function Pagination({ offset, total, size, onChange }) {
  return total > size ? <div className="dl-pagination"><button className="dp-btn dp-btn-outline dp-btn-sm" disabled={!offset} onClick={() => onChange(Math.max(0, offset - size))}>Previous</button><span>{offset + 1}–{Math.min(offset + size, total)} of {total}</span><button className="dp-btn dp-btn-outline dp-btn-sm" disabled={offset + size >= total} onClick={() => onChange(offset + size)}>Next</button></div> : null;
}
function Calendar() {
  const [day, setDay] = useState(localDay(new Date()));
  const resource = useResource((signal) => Promise.all([api.loadAppointments("limit=100&offset=0&from=" + encodeURIComponent(new Date(`${day}T00:00:00`).toISOString()), signal), api.loadSlots(signal)]).then(([appointments, slots]) => ({ appointments, slots })), day);
  const bookings = resource.data?.appointments.items.filter((a) => localDay(a.startsAt) === day && !["CANCELLED", "DECLINED"].includes(a.status)) || [];
  const slots = resource.data?.slots.items.filter((s) => localDay(s.startsAt) === day && s.state === "OPEN") || [];
  return <Page title="Calendar" description={`Your schedule · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`} resource={resource} actions={<Link to="/availability" className="dp-btn dp-btn-primary">Manage availability</Link>}>
    <div className="dl-filters"><label>Choose a date<input type="date" required value={day} onChange={(e) => e.target.value && setDay(e.target.value)} /></label></div><div className="dl-columns"><section className="dp-panel"><h2>Consultations</h2>{bookings.length ? <AppointmentCards items={bookings} /> : <Empty title="No consultations on this date" text="Confirmed and requested appointments appear in your calendar." />}</section><section className="dp-panel"><h2>Open consultation slots</h2>{slots.length ? slots.map((s) => <div className="dl-slot" key={s.id}><Clock size={17} /><strong>{time(s.startsAt)}–{time(s.endsAt)}</strong><span>{s.consultationTypes.map((t) => t === "VIRTUAL" ? "Virtual" : "In person").join(" · ")}</span></div>) : <Empty title="No open slots" text="Publish available times from Manage Availability." />}</section></div>
  </Page>;
}
function Availability() {
  const resource = useResource(api.loadSlots);
  const [form, setForm] = useState({ day: "", start: "09:00", end: "09:30", virtual: true, physical: false });
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");
  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  async function publish(event) {
    event.preventDefault(); setNotice("");
    const startsAt = new Date(`${form.day}T${form.start}`), endsAt = new Date(`${form.day}T${form.end}`);
    if (startsAt <= new Date() || endsAt <= startsAt) { setNotice("Choose a future start time and an end time after it."); return; }
    if (!form.virtual && !form.physical) { setNotice("Choose at least one consultation type."); return; }
    setBusy(true);
    try { await api.publishSlots([{ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), consultationTypes: [...(form.virtual ? ["VIRTUAL"] : []), ...(form.physical ? ["IN_PERSON"] : [])] }]); setNotice("Availability published. Patients can now book this slot."); resource.reload(); }
    catch (error) { setNotice(error.message); } finally { setBusy(false); }
  }
  async function cancel(id) { setBusy(true); setNotice(""); try { await api.cancelSlot(id); setNotice("Slot removed from patient booking."); resource.reload(); } catch (error) { setNotice(error.message); } finally { setBusy(false); } }
  return <Page title="Manage availability" description={`Publish consultation slots · Times are shown in ${Intl.DateTimeFormat().resolvedOptions().timeZone}.`} resource={resource}>
    {notice && <div className="dl-notice" role="status">{notice}</div>}<div className="dl-columns"><section className="dp-panel"><h2>Publish a slot</h2><p className="dl-muted">Publish the dates and times you can offer. Booked slots stay protected.</p><form className="dl-form" onSubmit={publish}><label>Date<input type="date" min={localDay(new Date())} required value={form.day} onChange={(e) => update("day", e.target.value)} /></label><div className="dl-form-row"><label>Starts at<input type="time" required value={form.start} onChange={(e) => update("start", e.target.value)} /></label><label>Ends at<input type="time" required value={form.end} onChange={(e) => update("end", e.target.value)} /></label></div><div className="dl-checks"><label><input type="checkbox" checked={form.virtual} onChange={(e) => update("virtual", e.target.checked)} /> Virtual</label><label><input type="checkbox" checked={form.physical} onChange={(e) => update("physical", e.target.checked)} /> In person</label></div><button className="dp-btn dp-btn-primary" disabled={busy}>{busy ? "Saving…" : "Publish availability"}</button></form></section><section className="dp-panel"><h2>Published slots · next 30 days</h2>{resource.data?.items.length ? <div className="dl-list">{resource.data.items.map((s) => <div className="dl-slot" key={s.id}><div><strong>{date(s.startsAt)}</strong><p>{time(s.startsAt)}–{time(s.endsAt)}</p><small>{s.consultationTypes.map((t) => t === "VIRTUAL" ? "Virtual" : "In person").join(" · ")}</small></div><Status value={s.state} />{s.state === "OPEN" && <button className="dp-btn dp-btn-outline dp-btn-sm" disabled={busy} onClick={() => cancel(s.id)}>Remove</button>}</div>)}</div> : <Empty title="No published availability" text="Add your first slot to appear in patient booking." />}</section></div>
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
function PendingFeature({ title, text }) { return <Page title={title} description={text}><section className="dp-panel"><Empty title={`${title} is being connected`} text="You can manage appointments, publish availability, and update your practice profile now." /><div className="dl-actions"><Link to="/appointments" className="dp-btn dp-btn-primary">Open appointments</Link><Link to="/dashboard" className="dp-btn dp-btn-outline">Back to dashboard</Link></div></section></Page>; }
export default function LiveDoctorWorkspace() {
  return <Routes>
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/appointments" element={<Appointments />} />
    <Route path="/appointments/:id" element={<Appointments />} />
    <Route path="/consultations" element={<Appointments consultations />} />
    <Route path="/calendar" element={<Calendar />} />
    <Route path="/availability" element={<Availability />} />
    <Route path="/patients" element={<Patients />} />
    <Route path="/profile" element={<Profile />} />
    <Route path="/settings" element={<Settings />} />
    <Route path="/notifications" element={<Notifications />} />
    <Route path="/prescriptions" element={<Prescriptions />} />
    {[{ path: "reports", title: "Reports", text: "Consultation reports and lab orders." }, { path: "messages", title: "Messages", text: "Patient conversations and care updates." }, { path: "hospital-workspace", title: "Hospital workspace", text: "Your hospital affiliations and assigned patient queues." }, { path: "earnings", title: "Earnings", text: "Consultation earnings and payout history." }, { path: "reviews", title: "Reviews", text: "Patient feedback on your care." }].map((feature) => <Route key={feature.path} path={`/${feature.path}`} element={<PendingFeature {...feature} />} />)}
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>;
}

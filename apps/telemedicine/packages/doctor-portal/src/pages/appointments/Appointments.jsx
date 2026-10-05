import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Video, Home, Ban } from "lucide-react";
import { PageTransition } from "design-system";
import PortalLayout from "../../components/PortalLayout";
import { useDoctorAppointments } from "../../hooks/useDoctorAppointments";
import {
  acceptAppointment,
  declineAppointment,
  cancelAppointment,
  rescheduleAppointment,
} from "../../store/doctorAppointmentStore";
import { addActivity } from "../../store/activityStore";
import { todayISODate, fullDateLabel, relativeDayLabel } from "../../utils/dateFormat";
import { bookingSourceLabel } from "../../utils/visitType";
import "./Appointments.css";

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "needs-response", label: "Needs Response" },
  { key: "past", label: "Past" },
  { key: "rescheduled", label: "Rescheduled" },
  { key: "cancelled", label: "Cancelled/Declined" },
];

const TYPE_META = {
  virtual: { label: "Virtual", Icon: Video },
  physical: { label: "Physical", Icon: Home },
  blocked: { label: "Blocked", Icon: Ban },
};

function statusTag(appt, today) {
  if (appt.status === "declined") return { text: "Declined", cls: "dp-tag-danger" };
  if (appt.status === "cancelled") return { text: "Cancelled", cls: "dp-tag-danger" };
  if (appt.rescheduledAt && appt.status === "active") return { text: "Rescheduled", cls: "dp-tag-warning" };
  if (appt.status === "checked-in") return { text: "Checked In", cls: "dp-tag-neutral" };
  if (appt.status === "past") return { text: "Completed", cls: "dp-tag-neutral" };
  if (appt.status === "needs-response") return { text: "Pending Review", cls: "dp-tag-warning" };
  if (appt.date < today) return { text: "Completed", cls: "dp-tag-neutral" };
  return { text: "Active", cls: "dp-tag-success" };
}

export function Appointments() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const appointments = useDoctorAppointments().filter((a) => a.type !== "blocked");
  const today = todayISODate();

  const initialTab = searchParams.get("tab") || "upcoming";
  const [tab, setTab] = useState(TABS.some((t) => t.key === initialTab) ? initialTab : "upcoming");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedId, setSelectedId] = useState(id || null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleForm, setRescheduleForm] = useState({ date: "", time: "" });

  const filtered = useMemo(() => {
    return appointments
      .filter((a) => {
        if (tab === "needs-response") return a.status === "needs-response";
        if (tab === "cancelled") return a.status === "declined" || a.status === "cancelled";
        if (tab === "rescheduled") return !!a.rescheduledAt && a.status !== "cancelled" && a.status !== "declined";
        if (tab === "past") return a.status === "past" || (a.status === "active" && a.date < today) || a.status === "checked-in";
        return (a.status === "active" || a.status === "checked-in") && a.date >= today;
      })
      .filter((a) => (typeFilter === "all" ? true : a.type === typeFilter))
      .filter((a) => (dateFilter ? a.date === dateFilter : true))
      .filter((a) => a.patientName.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => (a.date + a.startTime > b.date + b.startTime ? 1 : -1));
  }, [appointments, tab, typeFilter, dateFilter, query, today]);

  useEffect(() => {
    if (id) {
      setSelectedId(id);
      const appt = appointments.find((a) => a.id === id);
      if (appt) {
        const wantedTab =
          appt.status === "needs-response"
            ? "needs-response"
            : appt.status === "declined" || appt.status === "cancelled"
            ? "cancelled"
            : appt.status === "past" || appt.date < today
            ? "past"
            : "upcoming";
        setTab(wantedTab);
      }
    } else if (!selectedId && filtered.length > 0) {
      setSelectedId(filtered[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (filtered.length && !filtered.some((a) => a.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
    if (!filtered.length) setSelectedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  useEffect(() => { setRescheduleOpen(false); }, [selectedId]);

  const selected = appointments.find((a) => a.id === selectedId) || null;

  function selectTab(key) {
    setTab(key);
    setSearchParams(key === "upcoming" ? {} : { tab: key });
    navigate("/appointments" + (key === "upcoming" ? "" : `?tab=${key}`), { replace: true });
  }

  function handleAccept(appt) {
    acceptAppointment(appt.id);
    addActivity(`Accepted ${appt.patientName}'s request.`);
  }
  function handleDecline(appt) {
    declineAppointment(appt.id);
    addActivity(`Declined ${appt.patientName}'s request.`);
  }
  function handleCancel(appt) {
    cancelAppointment(appt.id);
    addActivity(`Cancelled the appointment with ${appt.patientName}.`);
  }
  function submitReschedule(e) {
    e.preventDefault();
    if (!rescheduleForm.date || !rescheduleForm.time || new Date(`${rescheduleForm.date}T${rescheduleForm.time}`) <= new Date()) return;
    const timeLabel = new Date(`2000-01-01T${rescheduleForm.time}`).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    rescheduleAppointment(selected.id, { date: rescheduleForm.date, startTime: timeLabel, endTime: new Date(new Date(`2000-01-01T${rescheduleForm.time}`).getTime() + 30 * 60 * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) });
    addActivity(`Rescheduled ${selected.patientName} to ${relativeDayLabel(rescheduleForm.date)} @ ${timeLabel}.`);
    setRescheduleOpen(false);
    selectTab("rescheduled");
  }

  const needsResponseCount = appointments.filter((a) => a.status === "needs-response").length;

  return (
    <PortalLayout topbarProps={{ placeholder: "Search patients..." }}>
      <PageTransition className="dp-appointments">
        <div className="dp-appointments-heading">
          <h1>Appointments</h1>
          <p>Manage incoming requests and scheduled visits.</p>
        </div>

        <div className="dp-tabs">
          {TABS.map((t) => (
            <button key={t.key} className={`dp-tab${tab === t.key ? " dp-tab-active" : ""}`} onClick={() => selectTab(t.key)}>
              {t.label}
              {t.key === "needs-response" && needsResponseCount > 0 && <span className="dp-tab-badge">{needsResponseCount}</span>}
            </button>
          ))}
        </div>

        <div className="dp-appt-filters">
          <input
            className="dp-appt-search"
            placeholder="Search patients..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="dp-appt-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">Visit Type</option>
            <option value="virtual">Virtual</option>
            <option value="physical">Physical</option>
          </select>
          <input className="dp-appt-select" type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
          {(typeFilter !== "all" || dateFilter) && (
            <button className="dp-text-btn" onClick={() => { setTypeFilter("all"); setDateFilter(""); }}>
              Clear
            </button>
          )}
        </div>

        <div className="dp-appt-layout">
          <div className="dp-appt-list">
            {filtered.length === 0 && <p className="dp-empty">No appointments in this view.</p>}
            {filtered.map((appt) => {
              const meta = TYPE_META[appt.type];
              const tag = statusTag(appt, today);
              return (
                <button
                  key={appt.id}
                  className={`dp-appt-list-item${selectedId === appt.id ? " dp-appt-list-item-active" : ""}`}
                  onClick={() => {
                    setSelectedId(appt.id);
                    navigate(`/appointments/${appt.id}${tab !== "upcoming" ? `?tab=${tab}` : ""}`, { replace: true });
                  }}
                >
                  <div className="dp-appt-list-type">
                    <meta.Icon size={13} /> {meta.label.toUpperCase()}
                  </div>
                  <span className={`dp-tag ${tag.cls}`}>{tag.text}</span>
                  <div className="dp-appt-list-name">{appt.patientName}</div>
                  <div className="dp-appt-list-time">
                    {relativeDayLabel(appt.date)}, {appt.startTime}
                    {bookingSourceLabel(appt) && ` · ${bookingSourceLabel(appt)}`}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="dp-appt-detail">
            {!selected ? (
              <p className="dp-empty">Select an appointment to view details.</p>
            ) : (
              <>
                <div className="dp-appt-detail-header">
                  {selected.status === "needs-response" && (
                    <span className="dp-tag dp-tag-warning">
                      {selected.requestType === "reschedule-request" ? "Reschedule Request" : "Pending Advance Request"}
                    </span>
                  )}
                  <span className="dp-appt-req-id">Req ID: #{selected.id.toUpperCase()}</span>
                  <div className="dp-appt-detail-actions">
                    {selected.status === "needs-response" ? (
                      <>
                        <button className="dp-text-btn dp-text-btn-danger" onClick={() => handleDecline(selected)}>
                          Decline
                        </button>
                        <button className="dp-btn dp-btn-primary dp-btn-sm" onClick={() => handleAccept(selected)}>
                          Accept Request
                        </button>
                      </>
                    ) : selected.status === "declined" || selected.status === "cancelled" || selected.status === "past" ? null : (
                      <>
                        <button className="dp-btn dp-btn-outline dp-btn-sm" onClick={() => { setRescheduleOpen(true); setRescheduleForm({ date: selected.date, time: "" }); }}>Reschedule</button>
                        <button className="dp-btn dp-btn-outline dp-btn-sm dp-text-btn-danger" onClick={() => handleCancel(selected)}>Cancel Appointment</button>
                      </>
                    )}
                  </div>
                </div>

                <h2 className="dp-appt-detail-name">{selected.patientName}</h2>

                {rescheduleOpen && (
                  <form className="dp-reschedule-inline" onSubmit={submitReschedule}>
                    <input type="date" aria-label="Rescheduled date" min={today} required value={rescheduleForm.date} onChange={(e) => setRescheduleForm((f) => ({ ...f, date: e.target.value }))} />
                    <input type="time" aria-label="Rescheduled time" required value={rescheduleForm.time} onChange={(e) => setRescheduleForm((f) => ({ ...f, time: e.target.value }))} />
                    <button type="submit" className="dp-btn dp-btn-primary dp-btn-sm">Save</button>
                    <button type="button" className="dp-btn dp-btn-outline dp-btn-sm" onClick={() => setRescheduleOpen(false)}>Cancel</button>
                  </form>
                )}

                <div className="dp-appt-detail-cards">
                  <div className="dp-detail-card">
                    <div className="dp-detail-card-label">Booking Context</div>
                    <div className="dp-detail-card-row">
                      <span>Patient</span>
                      <strong>
                        {selected.patientName} {selected.patientAge ? `(${selected.patientAge})` : ""}
                      </strong>
                    </div>
                    <div className="dp-detail-card-row">
                      <span>Booked By</span>
                      <strong>{selected.bookedBy || "Self"}</strong>
                    </div>
                  </div>
                  <div className="dp-detail-card">
                    <div className="dp-detail-card-label">Requested Time & Type</div>
                    <div className="dp-detail-card-row">
                      <span>Date & Time</span>
                      <strong>
                        {relativeDayLabel(selected.date)} · {selected.startTime}
                      </strong>
                    </div>
                    <div className="dp-detail-card-row">
                      <span>Type</span>
                      <strong>{TYPE_META[selected.type]?.label}</strong>
                    </div>
                    {bookingSourceLabel(selected) && (
                      <div className="dp-detail-card-row">
                        <span>Source</span>
                        <strong>{bookingSourceLabel(selected)}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {selected.reason && (
                  <div className="dp-detail-block">
                    <div className="dp-detail-card-label">Reason for Visit</div>
                    <p className="dp-detail-reason">"{selected.reason}"</p>
                  </div>
                )}

                {selected.address && (
                  <div className="dp-detail-block">
                    <div className="dp-detail-card-label">Address</div>
                    <p className="dp-detail-reason">{selected.address}</p>
                  </div>
                )}

                {selected.history && selected.history.length > 0 && (
                  <div className="dp-detail-block">
                    <div className="dp-detail-card-label">History With You</div>
                    <div className="dp-history-list">
                      {selected.history.map((h, i) => (
                        <div className="dp-history-row" key={i}>
                          <div className="dp-history-date">{h.date}</div>
                          <div>
                            <div className="dp-history-label">{h.label}</div>
                            {h.note && <div className="dp-history-note">{h.note}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </PageTransition>
    </PortalLayout>
  );
}

export default Appointments;

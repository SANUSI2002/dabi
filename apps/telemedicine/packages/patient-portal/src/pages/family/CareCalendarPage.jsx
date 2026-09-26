import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronRight as ArrowRight } from "lucide-react";

import "../../styles/share.css";
import "./FamilyCircle.css";
import "../appointments/Appointments.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { useApiData } from "../../api/useApiData";
import { getCalendar, getUpcomingCare, initialsOf } from "../../api/familyApi";
import { toCalendarDate, formatCalendarDate, isSameDay, isToday } from "../appointments/components/AppointmentCalendar";
import { colorFor } from "./data";

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const STATUS_LABELS = {
  PENDING: "Awaiting confirmation", REQUESTED: "Awaiting confirmation", SCHEDULED: "Confirmed", CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked in", CANCELLED: "Cancelled", REJECTED: "Declined", DECLINED: "Declined", COMPLETED: "Completed",
};
// Cancelled and declined appointments aren't on anyone's schedule, so the calendar leaves them out.
const ENDED = new Set(["CANCELLED", "REJECTED", "DECLINED"]);
const onSchedule = (e) => !ENDED.has(e.status);

const clock = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const memberColor = (id) => (id === "self" ? "#2E6B5A" : colorFor(id));

function createMonthGrid(currentMonth) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingDays = (firstDay.getDay() + 6) % 7;
  const days = [];
  for (let offset = leadingDays; offset > 0; offset -= 1) days.push({ date: new Date(year, month, 1 - offset), muted: true });
  for (let day = 1; day <= daysInMonth; day += 1) days.push({ date: new Date(year, month, day), muted: false });
  while (days.length % 7 !== 0) days.push({ date: new Date(year, month + 1, days.length - leadingDays - daysInMonth + 1), muted: true });
  return days;
}

export function CareCalendarPage() {
  const [zoom] = useZoom();
  const navigate = useNavigate();
  const today = useMemo(() => toCalendarDate(new Date()), []);
  const [currentMonth, setCurrentMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);

  const days = useMemo(() => createMonthGrid(currentMonth), [currentMonth]);
  const weeks = useMemo(() => Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7)), [days]);

  // One request per visible grid (at most 6 weeks, within the API's 43-day window).
  const rangeKey = formatCalendarDate(days[0].date);
  const month = useApiData(() => {
    const from = new Date(days[0].date);
    const to = new Date(days[days.length - 1].date);
    to.setDate(to.getDate() + 1);
    return getCalendar(from, to);
  }, [rangeKey]);
  const upcoming = useApiData(() => getUpcomingCare(20), []);

  const members = month.data?.members || upcoming.data?.members || [];
  const eventsByDate = useMemo(() => {
    const map = new Map();
    for (const e of (month.data?.events || []).filter(onSchedule)) {
      const key = formatCalendarDate(new Date(e.time));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    return map;
  }, [month.data]);

  const selectedDayEvents = eventsByDate.get(formatCalendarDate(selectedDate)) || [];
  const upcomingEvents = (upcoming.data?.events || []).filter(onSchedule);
  const openMember = (id) => navigate(id === "self" ? "/profile" : `/family/member/${id}`);

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar placeholder="Search family, appointments..." />

        <button className="sabi-rxd-back" onClick={() => navigate("/family")} style={{ marginBottom: 12 }}>
          <ArrowLeft size={16} /> Back to Family Circle
        </button>

        <div className="sabi-fam-header" style={{ marginBottom: 16 }}>
          <div>
            <h1>Care Calendar</h1>
            <p>Appointments for you, your dependents, and members who share their appointments with you.</p>
          </div>
        </div>

        {month.error && <p className="sabi-form-error" role="alert">{month.error.message}</p>}

        <div className="sabi-care-cal-layout">
          <aside className="sabi-card sabi-care-cal-members">
            <h3>Care Circle</h3>
            <div className="sabi-care-cal-member-list">
              {members.map((m) => (
                <button type="button" className="sabi-care-cal-member-row" key={m.id} onClick={() => openMember(m.id)}>
                  <span className="sabi-fam-avatar" style={{ background: memberColor(m.id), width: 30, height: 30, fontSize: ".72rem" }}>{initialsOf(m.name)}</span>
                  <span className="sabi-care-cal-member-name">
                    <strong>{m.name}</strong>
                    <small>{m.relationship}</small>
                  </span>
                  <ArrowRight size={14} className="chevron" />
                </button>
              ))}
              {!members.length && <p className="sabi-modal-empty">{month.loading ? "Loading…" : "No one in your circle yet."}</p>}
            </div>
          </aside>

          <div className="sabi-care-cal-main">
            <div className="sabi-card">
              <div className="sabi-apt-calendar-head">
                <h3>{MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h3>
                <div className="sabi-apt-calendar-nav">
                  <button type="button" aria-label="Previous month" onClick={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}><ChevronLeft size={16} /></button>
                  <button type="button" aria-label="Next month" onClick={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}><ChevronRight size={16} /></button>
                </div>
              </div>

              <div className="sabi-apt-calendar-grid sabi-apt-calendar-weekdays">
                {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
              </div>

              {weeks.map((week, weekIndex) => (
                <div className="sabi-apt-calendar-grid" key={weekIndex}>
                  {week.map(({ date, muted }) => {
                    const key = formatCalendarDate(date);
                    const dayEvents = eventsByDate.get(key) || [];
                    return (
                      <button
                        type="button"
                        key={key}
                        aria-label={`${date.toDateString()}${dayEvents.length ? `, ${dayEvents.length} appointment${dayEvents.length > 1 ? "s" : ""}` : ""}`}
                        className={["sabi-apt-day", "sabi-apt-day-btn", muted && "muted", isSameDay(date, selectedDate) && "selected", isToday(date, today) && "today"].filter(Boolean).join(" ")}
                        onClick={() => setSelectedDate(date)}
                      >
                        {date.getDate()}
                        {dayEvents.length > 0 && (
                          <span className="sabi-care-cal-dots">
                            {dayEvents.slice(0, 3).map((e) => (
                              <span key={`${e.memberId}-${e.id}`} className="sabi-care-cal-dot" style={{ background: memberColor(e.memberId) }} />
                            ))}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="sabi-card">
              <div className="sabi-fam-section-head">
                <h2 style={{ fontSize: "1rem" }}>
                  {isSameDay(selectedDate, today) ? "Today's Events" : selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                </h2>
              </div>
              {selectedDayEvents.length > 0 ? (
                <div className="sabi-fam-member-appt-list">
                  {selectedDayEvents.map((e) => (
                    <div className="sabi-fam-member-appt-row" key={`${e.memberId}-${e.id}`}>
                      <span className="dot" style={{ background: memberColor(e.memberId) }} />
                      <div>
                        <strong>{e.title}</strong>
                        <span>{e.memberName} · {clock(e.time)} · {STATUS_LABELS[e.status] || e.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="sabi-modal-empty">{month.loading ? "Loading…" : "No appointments this day."}</p>
              )}
            </div>

            <div className="sabi-card">
              <div className="sabi-fam-section-head">
                <h2 style={{ fontSize: "1rem" }}>Upcoming</h2>
              </div>
              {upcomingEvents.length > 0 ? (
                <div className="sabi-fam-member-appt-list">
                  {upcomingEvents.map((e) => (
                    <div className="sabi-fam-member-appt-row" key={`${e.memberId}-${e.id}`}>
                      <span className="dot" style={{ background: memberColor(e.memberId) }} />
                      <div>
                        <strong>{new Date(e.time).toLocaleDateString(undefined, { month: "short", day: "numeric" })} — {e.memberName}</strong>
                        <span>{e.title} · {clock(e.time)} · {STATUS_LABELS[e.status] || e.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="sabi-modal-empty">{upcoming.loading ? "Loading…" : "No upcoming appointments across your circle."}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CareCalendarPage;

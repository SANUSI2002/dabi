import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronRight as ArrowRight } from "lucide-react";

import "../../styles/share.css";
import "./FamilyCircle.css";
import "../appointments/Appointments.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { getMembers } from "./familyStore";
import { useApiData } from "../../api/useApiData";
import { getCalendar, getUpcomingCare } from "../../api/familyApi";
import { toCalendarDate, formatCalendarDate, isSameDay, isToday } from "../appointments/components/AppointmentCalendar";

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function createMonthGrid(currentMonth) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const previousMonthDays = new Date(year, month, 0).getDate();
  const leadingDays = (firstDay.getDay() + 6) % 7;
  const days = [];

  for (let offset = leadingDays; offset > 0; offset -= 1) {
    days.push({ date: new Date(year, month - 1, previousMonthDays - offset + 1), muted: true });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push({ date: new Date(year, month, day), muted: false });
  }
  while (days.length % 7 !== 0) {
    const nextMonthDay = days.length - leadingDays - daysInMonth + 1;
    days.push({ date: new Date(year, month + 1, nextMonthDay), muted: true });
  }
  return days;
}

// Every event from the circle calendar belongs to the member it was booked for
// (doctor bookings, hospital appointments, and dependents' appointments).
function buildFamilyEvents(members, calendarEvents) {
  return calendarEvents
    .map((e) => {
      const member = members.find((m) => m.id === e.memberId) || { id: e.memberId, name: e.memberName, color: "#2E6B5A", isSelf: e.memberId === "self" };
      const date = toCalendarDate(new Date(e.time));
      if (!date) return null;
      const time = new Date(e.time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      return { id: e.id, date, member, title: e.title, time, status: e.status };
    })
    .filter(Boolean)
    .sort((a, b) => a.date - b.date);
}

export function CareCalendarPage() {
  const [zoom] = useZoom();
  const navigate = useNavigate();
  const today = useMemo(() => toCalendarDate(new Date()), []);
  const [currentMonth, setCurrentMonth] = useState(() => getMonthStart(today));
  const [selectedDate, setSelectedDate] = useState(today);

  const { data: membersData } = useApiData(getMembers, []);
  const members = useMemo(() => membersData || [], [membersData]);
  // The visible month (with the leading/trailing days of the grid) and what's coming up.
  const { data: monthData } = useApiData(() => {
    const from = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), -7);
    const to = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 8);
    return getCalendar(from, to);
  }, [currentMonth]);
  const { data: upcomingData } = useApiData(() => getUpcomingCare(20), []);
  const events = useMemo(() => buildFamilyEvents(members, monthData?.events || []), [members, monthData]);

  const eventsByDate = useMemo(() => {
    const map = new Map();
    events.forEach((e) => {
      const key = formatCalendarDate(e.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    });
    return map;
  }, [events]);

  const days = useMemo(() => createMonthGrid(currentMonth), [currentMonth]);
  const weeks = useMemo(() => Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7)), [days]);

  const selectedDayEvents = eventsByDate.get(formatCalendarDate(selectedDate)) || [];
  const upcomingEvents = useMemo(() => buildFamilyEvents(members, upcomingData?.events || []), [members, upcomingData]);

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
            <p>Everyone in your circle&apos;s appointments, at a glance.</p>
          </div>
        </div>

        <div className="sabi-care-cal-layout">
          <aside className="sabi-card sabi-care-cal-members">
            <h3>Care Circle</h3>
            <div className="sabi-care-cal-member-list">
              {members.map((m) => (
                <button type="button" className="sabi-care-cal-member-row" key={m.id} onClick={() => navigate(`/family/member/${m.id}`)}>
                  <span className="sabi-fam-avatar" style={{ background: m.color, width: 30, height: 30, fontSize: ".72rem" }}>{m.initials}</span>
                  <span className="sabi-care-cal-member-name">
                    <strong>{m.isSelf ? "Myself" : m.name}</strong>
                    <small>{m.relationship}</small>
                  </span>
                  <ArrowRight size={14} className="chevron" />
                </button>
              ))}
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
                    const selected = isSameDay(date, selectedDate);
                    return (
                      <button
                        type="button"
                        key={key}
                        className={["sabi-apt-day", "sabi-apt-day-btn", muted && "muted", selected && "selected", isToday(date, today) && "today"].filter(Boolean).join(" ")}
                        onClick={() => setSelectedDate(date)}
                      >
                        {date.getDate()}
                        {dayEvents.length > 0 && (
                          <span className="sabi-care-cal-dots">
                            {dayEvents.slice(0, 3).map((e) => (
                              <span key={e.id} className="sabi-care-cal-dot" style={{ background: e.member.color }} />
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
                  {isSameDay(selectedDate, today) ? "Today's Events" : selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </h2>
              </div>
              {selectedDayEvents.length > 0 ? (
                <div className="sabi-fam-member-appt-list">
                  {selectedDayEvents.map((e) => (
                    <div className="sabi-fam-member-appt-row" key={e.id}>
                      <span className="dot" style={{ background: e.member.color }} />
                      <div>
                        <strong>{e.title}</strong>
                        <span>{e.member.isSelf ? "Myself" : e.member.name} · {e.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="sabi-modal-empty">No events for this day.</p>
              )}
            </div>

            <div className="sabi-card">
              <div className="sabi-fam-section-head">
                <h2 style={{ fontSize: "1rem" }}>Upcoming</h2>
              </div>
              {upcomingEvents.length > 0 ? (
                <div className="sabi-fam-member-appt-list">
                  {upcomingEvents.map((e) => (
                    <div className="sabi-fam-member-appt-row" key={e.id}>
                      <span className="dot" style={{ background: e.member.color }} />
                      <div>
                        <strong>{e.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — {e.member.isSelf ? "Myself" : e.member.name}</strong>
                        <span>{e.title} · {e.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="sabi-modal-empty">No upcoming events across your care circle.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CareCalendarPage;

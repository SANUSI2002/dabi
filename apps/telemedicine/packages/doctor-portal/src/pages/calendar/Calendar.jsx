import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Printer, Video, Home, MapPin } from "lucide-react";
import { PageTransition } from "design-system";
import PortalLayout from "../../components/PortalLayout";
import { useDoctorAppointments } from "../../hooks/useDoctorAppointments";
import { toISO, monthYearLabel } from "../../utils/dateFormat";
import { bookingSourceLabel } from "../../utils/visitType";
import { buildDaySlots, timeToMinutes } from "../../utils/slots";
import { BlockTimeModal } from "../dashboard/DashboardModals";
import "../dashboard/DashboardModals.css";
import "./Calendar.css";

const TYPE_ICON = { virtual: Video, physical: Home, blocked: null };

function MiniCalendar({ viewDate, setViewDate, selectedISO, setSelectedISO, appointments }) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const datesWithAppts = new Set(appointments.map((a) => a.date));

  return (
    <div className="dp-mini-cal">
      <div className="dp-mini-cal-header">
        <span>{monthYearLabel(viewDate)}</span>
        <div className="dp-mini-cal-nav">
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))} aria-label="Previous month">
            <ChevronLeft size={15} />
          </button>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))} aria-label="Next month">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
      <div className="dp-mini-cal-grid dp-mini-cal-dow">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="dp-mini-cal-grid">
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const cellDate = new Date(year, month, d);
          const cellISO = toISO(cellDate);
          const isSelected = cellISO === selectedISO;
          const hasAppts = datesWithAppts.has(cellISO);
          return (
            <button
              key={i}
              className={`dp-mini-cal-day${isSelected ? " dp-mini-cal-day-selected" : ""}`}
              onClick={() => setSelectedISO(cellISO)}
            >
              {d}
              {hasAppts && !isSelected && <span className="dp-mini-cal-dot" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Calendar() {
  const navigate = useNavigate();
  const appointments = useDoctorAppointments();
  const [view, setView] = useState("day");
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedISO, setSelectedISO] = useState(toISO(new Date()));
  const [blockModal, setBlockModal] = useState(false);
  const [showAllSlots, setShowAllSlots] = useState(false);

  const dayAppointments = useMemo(
    () => appointments.filter((a) => a.date === selectedISO && a.status !== "needs-response" && a.status !== "declined").sort((a, b) => (a.startTime > b.startTime ? 1 : -1)),
    [appointments, selectedISO]
  );

  const slots = useMemo(() => buildDaySlots(dayAppointments), [dayAppointments]);
  const visibleSlots = showAllSlots ? slots : slots.slice(0, 10);

  const selectedDateObj = new Date(`${selectedISO}T00:00:00`);
  const dayLabel = selectedDateObj.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const bookedCount = dayAppointments.filter((a) => a.type !== "blocked").length;
  const availableCount = slots.filter((s) => s.status === "available").length;

  function shiftDay(delta) {
    const d = new Date(`${selectedISO}T00:00:00`);
    d.setDate(d.getDate() + delta);
    setSelectedISO(toISO(d));
    setViewDate(d);
  }

  return (
    <PortalLayout
      topbarProps={{
        placeholder: "Search patients, records...",
        children: (
          <>
            <div className="dp-view-toggle">
              {["month", "week", "day"].map((v) => (
                <button key={v} className={`dp-view-toggle-btn${view === v ? " dp-view-toggle-active" : ""}`} onClick={() => setView(v)}>
                  {v[0].toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <button className="dp-btn dp-btn-primary dp-btn-sm" onClick={() => navigate("/availability")}>
              Manage Availability
            </button>
          </>
        ),
      }}
    >
      <PageTransition className="dp-calendar">
        {view === "day" && (
          <div className="dp-calendar-layout">
            <div className="dp-calendar-left">
              <MiniCalendar
                viewDate={viewDate}
                setViewDate={setViewDate}
                selectedISO={selectedISO}
                setSelectedISO={(iso) => {
                  setSelectedISO(iso);
                }}
                appointments={appointments}
              />
              <div className="dp-legend">
                <div className="dp-legend-title">LEGEND</div>
                <div className="dp-legend-row">
                  <Video size={14} /> Virtual
                </div>
                <div className="dp-legend-row">
                  <Home size={14} /> Physical (direct booking)
                </div>
                <div className="dp-legend-row">
                  <Home size={14} /> Physical (affiliate hospital)
                </div>
              </div>
            </div>

            <div className="dp-calendar-center">
              <div className="dp-day-header">
                <div>
                  <div className="dp-day-nav">
                    <button onClick={() => shiftDay(-1)} aria-label="Previous day">
                      <ChevronLeft size={16} />
                    </button>
                    <h2>{dayLabel}</h2>
                    <button onClick={() => shiftDay(1)} aria-label="Next day">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  <p>
                    {bookedCount} Appointment{bookedCount === 1 ? "" : "s"} · {availableCount} Available Slots
                  </p>
                </div>
                <button className="dp-icon-btn-outline" onClick={() => window.print()} aria-label="Print schedule">
                  <Printer size={16} />
                </button>
              </div>

              <div className="dp-day-timeline">
                {dayAppointments.length === 0 && <p className="dp-empty">Nothing on the calendar for this day.</p>}
                {dayAppointments.map((appt) => {
                  const Icon = TYPE_ICON[appt.type];
                  return (
                    <div key={appt.id} className={`dp-day-block${appt.type === "blocked" ? " dp-day-block-muted" : " dp-day-block-active"}`}>
                      <div className="dp-day-block-time">
                        {appt.startTime} {appt.endTime && `- ${appt.endTime}`}
                      </div>
                      <div className="dp-day-block-name-row">
                        {Icon && <Icon size={14} />}
                        {appt.type === "physical" && appt.bookingSource === "direct" && <MapPin size={12} />}
                        <span>{appt.patientName}</span>
                        {bookingSourceLabel(appt) && <span className="dp-tag dp-tag-neutral">{bookingSourceLabel(appt)}</span>}
                        {appt.travelMinutes && <span className="dp-tag dp-tag-neutral">Travel: {appt.travelMinutes}m</span>}
                      </div>
                      {appt.address && <div className="dp-day-block-sub">{appt.address}</div>}
                      {appt.room && <div className="dp-day-block-sub">{appt.room}</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="dp-calendar-right">
              <div className="dp-panel-title-plain">Slot Overview</div>
              <p className="dp-slot-sub">30-min intervals</p>
              <div className="dp-slot-list">
                {visibleSlots.map((slot) => (
                  <div
                    key={slot.time}
                    className={`dp-slot-row${slot.status === "booked" ? " dp-slot-row-booked" : ""}`}
                    onClick={() => {
                      if (slot.status === "available") setBlockModal(true);
                      else if (slot.apptId) navigate(`/appointments/${slot.apptId}`);
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div>
                      <div className="dp-slot-time">{slot.time}</div>
                      {slot.patientName && <div className="dp-slot-patient">{slot.patientName}</div>}
                    </div>
                    <span className={`dp-tag ${slot.status === "available" ? "dp-tag-success" : slot.status === "blocked" ? "dp-tag-neutral" : "dp-tag-warning"}`}>
                      {slot.status === "available" ? "Available" : slot.status === "blocked" ? "Blocked" : "Booked"}
                    </span>
                  </div>
                ))}
              </div>
              {slots.length > 10 && (
                <button className="dp-link-btn dp-slot-toggle" onClick={() => setShowAllSlots((v) => !v)}>
                  {showAllSlots ? "Show Less" : "View Remaining Slots"}
                </button>
              )}
            </div>
          </div>
        )}

        {view === "week" && <WeekView selectedISO={selectedISO} appointments={appointments} onPickDay={(iso) => { setSelectedISO(iso); setView("day"); }} />}
        {view === "month" && (
          <MonthView
            viewDate={viewDate}
            setViewDate={setViewDate}
            appointments={appointments}
            onPickDay={(iso) => {
              setSelectedISO(iso);
              setView("day");
            }}
          />
        )}
      </PageTransition>

      {blockModal && <BlockTimeModal onClose={() => setBlockModal(false)} onSaved={() => {}} />}
    </PortalLayout>
  );
}

function WeekView({ selectedISO, appointments, onPickDay }) {
  const start = new Date(`${selectedISO}T00:00:00`);
  start.setDate(start.getDate() - start.getDay());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  return (
    <div className="dp-week-grid">
      {days.map((d) => {
        const iso = toISO(d);
        const dayAppts = appointments.filter((a) => a.date === iso && a.status !== "needs-response" && a.status !== "declined");
        return (
          <div key={iso} className="dp-week-col" onClick={() => onPickDay(iso)}>
            <div className="dp-week-col-header">
              <span>{d.toLocaleDateString("en-US", { weekday: "short" })}</span>
              <strong>{d.getDate()}</strong>
            </div>
            <div className="dp-week-col-body">
              {dayAppts.length === 0 && <span className="dp-week-empty">—</span>}
              {dayAppts.map((a) => (
                <div key={a.id} className="dp-week-appt">
                  {a.startTime} · {a.patientName}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthView({ viewDate, setViewDate, appointments, onPickDay }) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="dp-month-view">
      <div className="dp-mini-cal-header dp-month-header">
        <span>{monthYearLabel(viewDate)}</span>
        <div className="dp-mini-cal-nav">
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))}>
            <ChevronLeft size={15} />
          </button>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))}>
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
      <div className="dp-month-grid dp-month-dow">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="dp-month-grid">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="dp-month-cell dp-month-cell-empty" />;
          const cellISO = toISO(new Date(year, month, d));
          const count = appointments.filter((a) => a.date === cellISO && a.status !== "needs-response" && a.status !== "declined").length;
          return (
            <button key={i} className="dp-month-cell" onClick={() => onPickDay(cellISO)}>
              <span>{d}</span>
              {count > 0 && <span className="dp-month-cell-count">{count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default Calendar;

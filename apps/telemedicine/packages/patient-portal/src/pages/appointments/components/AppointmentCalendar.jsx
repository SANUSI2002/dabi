import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "design-system";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const YEARS = Array.from({ length: 20 }, (_, index) => 2020 + index);

/** Converts dates to local, midnight-normalized calendar values. */
export function toCalendarDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
      ? date
      : null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatCalendarDate(value) {
  const date = toCalendarDate(value);
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isSameDay(firstValue, secondValue) {
  const first = toCalendarDate(firstValue);
  const second = toCalendarDate(secondValue);
  return Boolean(first && second && first.getTime() === second.getTime());
}

export function isToday(value, today = new Date()) {
  return isSameDay(value, today);
}

export function isPastDay(value, today = new Date()) {
  const date = toCalendarDate(value);
  const normalizedToday = toCalendarDate(today);
  return Boolean(date && normalizedToday && date.getTime() < normalizedToday.getTime());
}

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

export function AppointmentCalendar({ selectedDate, onDateSelect, appointments = [] }) {
  const today = useMemo(() => toCalendarDate(new Date()), []);
  const selectedCalendarDate = toCalendarDate(selectedDate);
  const [currentMonth, setCurrentMonth] = useState(() => getMonthStart(selectedCalendarDate || today));

  useEffect(() => {
    if (selectedCalendarDate) setCurrentMonth(getMonthStart(selectedCalendarDate));
  }, [selectedDate]);

  const appointmentDates = useMemo(
    () => new Set(appointments.map((appointment) => formatCalendarDate(appointment.date)).filter(Boolean)),
    [appointments]
  );

  const days = useMemo(() => createMonthGrid(currentMonth), [currentMonth]);
  const weeks = useMemo(() => Array.from({ length: days.length / 7 }, (_, index) => days.slice(index * 7, index * 7 + 7)), [days]);
  const isCurrentMonth = currentMonth.getFullYear() === today.getFullYear() && currentMonth.getMonth() === today.getMonth();

  const selectDate = useCallback((date) => {
    if (isPastDay(date, today)) return;
    onDateSelect?.(toCalendarDate(date));
  }, [onDateSelect, today]);

  const moveMonth = useCallback((offset) => {
    setCurrentMonth((month) => new Date(month.getFullYear(), month.getMonth() + offset, 1));
  }, []);

  const handleDateKeyDown = useCallback((event, date) => {
    const dayOffsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const offset = dayOffsets[event.key];

    if (offset === undefined) return;
    event.preventDefault();
    const nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
    if (isPastDay(nextDate, today)) return;

    setCurrentMonth(getMonthStart(nextDate));
    onDateSelect?.(toCalendarDate(nextDate));
  }, [onDateSelect, today]);

  return (
    <Card className="sabi-apt-calendar">
      <div className="sabi-apt-calendar-head">
        <div className="calendar-selectors">
          <select value={currentMonth.getMonth()} aria-label="Select month" onChange={(event) => setCurrentMonth((month) => new Date(month.getFullYear(), Number(event.target.value), 1))}>
            {MONTHS.map((month, index) => <option key={month} value={index}>{month}</option>)}
          </select>
          <select value={currentMonth.getFullYear()} aria-label="Select year" onChange={(event) => setCurrentMonth((month) => new Date(Number(event.target.value), month.getMonth(), 1))}>
            {YEARS.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>

        <div className="sabi-apt-calendar-nav">
          <button type="button" aria-label="Show previous month" onClick={() => moveMonth(-1)}><ChevronLeft size={16} /></button>
          <button type="button" aria-label="Show next month" onClick={() => moveMonth(1)}><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="sabi-apt-calendar-grid sabi-apt-calendar-weekdays">
        {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
      </div>

      <div aria-label={`${MONTHS[currentMonth.getMonth()]} ${currentMonth.getFullYear()} appointment calendar`}>
        {weeks.map((week, weekIndex) => (
          <div className="sabi-apt-calendar-grid" key={`${currentMonth.getFullYear()}-${currentMonth.getMonth()}-${weekIndex}`}>
            {week.map(({ date, muted }) => {
              const dateKey = formatCalendarDate(date);
              const past = isPastDay(date, today);
              const selected = isSameDay(date, selectedCalendarDate);
              const todayInDisplayedMonth = isCurrentMonth && isToday(date, today);
              const disabled = muted || past;

              return (
                <button
                  type="button"
                  key={dateKey}
                  className={["sabi-apt-day", "sabi-apt-day-btn", muted && "muted", past && "disabled", selected && "selected", todayInDisplayedMonth && "today"].filter(Boolean).join(" ")}
                  disabled={disabled}
                  aria-label={`${date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}${appointmentDates.has(dateKey) ? ", has appointment" : ""}`}
                  aria-selected={selected}
                  aria-pressed={selected}
                  aria-current={todayInDisplayedMonth ? "date" : undefined}
                  onClick={() => selectDate(date)}
                  onKeyDown={(event) => handleDateKeyDown(event, date)}
                >
                  {date.getDate()}
                  {appointmentDates.has(dateKey) && <span className="sabi-apt-day-dot" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </Card>
  );
}

export default AppointmentCalendar;

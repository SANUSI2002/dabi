import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useApiData } from "../../../api/useApiData";
import { groupSlotsByDay, listDoctorSlots } from "../../../api/doctorsApi";

/**
 * A doctor's real open slots, two weeks at a time. `refreshKey` reloads after a slot is taken.
 * Calls onSelect(slot) with { id, startsAt, endsAt, consultationTypes, time }.
 */
export function SlotPicker({ doctorId, selectedId, onSelect, refreshKey = 0 }) {
  const [windowStart, setWindowStart] = useState(() => new Date());
  const { data, loading, error, reload } = useApiData(() => listDoctorSlots(doctorId, windowStart), [doctorId, windowStart.getTime(), refreshKey]);
  const days = useMemo(() => groupSlotsByDay(data || []), [data]);
  const [dayKey, setDayKey] = useState(null);

  // Default to the first day with openings whenever the window's slots change.
  useEffect(() => {
    if (days.length && !days.some((d) => d.key === dayKey)) setDayKey(days[0].key);
  }, [days, dayKey]);

  const day = days.find((d) => d.key === dayKey);
  const atStart = windowStart.getTime() <= Date.now() + 60000;
  const shift = (weeks) => {
    onSelect(null);
    setDayKey(null);
    setWindowStart((w) => new Date(Math.max(Date.now(), w.getTime() + weeks * 14 * 86400000)));
  };

  return (
    <>
      <div className="sabi-booking-section">
        <div className="sabi-slot-window">
          <span className="sabi-booking-label"><CalendarDays size={14} /> Availability</span>
          <div>
            <button type="button" aria-label="Earlier dates" disabled={atStart || loading} onClick={() => shift(-1)}><ChevronLeft size={16} /></button>
            <span>
              {windowStart.toLocaleDateString(undefined, { day: "numeric", month: "short" })} –{" "}
              {new Date(windowStart.getTime() + 13 * 86400000).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </span>
            <button type="button" aria-label="Later dates" disabled={loading} onClick={() => shift(1)}><ChevronRight size={16} /></button>
          </div>
        </div>
        {error ? (
          <p className="sabi-form-error" role="alert">{error.message} <button type="button" className="sabi-slot-retry" onClick={reload}>Retry</button></p>
        ) : loading && !data ? (
          <p className="sabi-slot-empty"><Loader2 size={15} className="sabi-spin" /> Loading open times…</p>
        ) : days.length === 0 ? (
          <p className="sabi-slot-empty">No open times in these two weeks. Try later dates.</p>
        ) : (
          <div className="sabi-booking-days" role="listbox" aria-label="Day">
            {days.map((d) => (
              <button key={d.key} type="button" role="option" aria-selected={dayKey === d.key} className={dayKey === d.key ? "active" : ""} onClick={() => { setDayKey(d.key); onSelect(null); }}>
                <small>{d.weekday}</small>
                <strong>{d.day}</strong>
              </button>
            ))}
          </div>
        )}
      </div>

      {day && (
        <div className="sabi-booking-section">
          <span className="sabi-booking-label">Open Times</span>
          <div className="sabi-booking-slots" role="listbox" aria-label="Time">
            {day.slots.map((slot) => (
              <button key={slot.id} type="button" role="option" aria-selected={selectedId === slot.id} className={selectedId === slot.id ? "active" : ""} onClick={() => onSelect(slot)}>
                {slot.time}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default SlotPicker;

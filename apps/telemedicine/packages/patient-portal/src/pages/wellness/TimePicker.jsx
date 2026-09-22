import React from "react";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1-12
const MINUTES = ["00", "15", "30", "45"];

// Converts a 24-hour "HH:MM" string to { hour12, minute, period }.
function parse(value) {
  if (!value) return { hour12: 8, minute: "00", period: "AM" };
  const [h, m] = value.split(":").map((s) => s);
  const hour24 = parseInt(h, 10);
  const period = hour24 >= 12 ? "PM" : "AM";
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, minute: MINUTES.includes(m) ? m : "00", period };
}

function toValue(hour12, minute, period) {
  let hour24 = hour12 % 12;
  if (period === "PM") hour24 += 12;
  return `${String(hour24).padStart(2, "0")}:${minute}`;
}

// A friendlier alternative to the native <input type="time"> — three
// plain dropdowns (hour / minute / AM-PM), always legible regardless
// of OS/browser time-picker quirks. Emits the same 24-hour "HH:MM"
// string the rest of the app already expects.
export function TimePicker({ value, onChange, label }) {
  const { hour12, minute, period } = parse(value);

  const update = (patch) => {
    const next = { hour12, minute, period, ...patch };
    onChange(toValue(next.hour12, next.minute, next.period));
  };

  return (
    <div className="sabi-time-picker">
      {label && <span className="sabi-booking-label">{label}</span>}
      <div className="sabi-time-picker-row">
        <select value={hour12} onChange={(e) => update({ hour12: Number(e.target.value) })} aria-label="Hour">
          {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <span className="sabi-time-picker-colon">:</span>
        <select value={minute} onChange={(e) => update({ minute: e.target.value })} aria-label="Minute">
          {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <div className="sabi-time-picker-period">
          <button type="button" className={period === "AM" ? "active" : ""} onClick={() => update({ period: "AM" })}>AM</button>
          <button type="button" className={period === "PM" ? "active" : ""} onClick={() => update({ period: "PM" })}>PM</button>
        </div>
      </div>
    </div>
  );
}

export default TimePicker;

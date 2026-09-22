import React from "react";

export function AdherenceCard({ adherence }) {
  return (
    <div className="sabi-card sabi-rx-adherence-card">
      <div className="sabi-section-title">7-Day Adherence</div>
      <p className="sabi-rx-adherence-message">{adherence.message}</p>
      <div className="sabi-rx-adherence-days">
        {adherence.days.map((day) => (
          <span
            key={day}
            className={`sabi-rx-adherence-day ${day === adherence.activeDay ? "active" : ""}`}
          >
            {day}
          </span>
        ))}
      </div>
    </div>
  );
}

export default AdherenceCard;
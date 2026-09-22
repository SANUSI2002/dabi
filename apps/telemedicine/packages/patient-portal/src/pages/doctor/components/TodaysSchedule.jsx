import React from "react";
import { Card } from "design-system";
import { SectionTitle } from "../share";
import { SCHEDULE } from "../data";

export function TodaysSchedule() {
  return (
    <Card>
      <SectionTitle>Today's Schedule</SectionTitle>
      <div className="sabi-timeline">
        {SCHEDULE.map((s, i) => (
          <div className={`sabi-timeline-item${i === 0 ? " active" : ""}`} key={i}>
            <div className="sabi-timeline-marker">
              <span className="sabi-timeline-dot" />
              <span className="sabi-timeline-line" />
            </div>
            <div>
              <div className="sabi-timeline-time">{s.time}</div>
              <div className="sabi-timeline-title">{s.title}</div>
              {s.activeSub && <div className="sabi-timeline-sub">{s.activeSub}</div>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default TodaysSchedule;

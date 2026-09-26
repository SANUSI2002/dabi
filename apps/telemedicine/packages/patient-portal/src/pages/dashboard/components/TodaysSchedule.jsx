import React from "react";
import { Card } from "design-system";
import { SectionTitle } from "../share";
import { useApiData } from "../../../api/useApiData";
import { getUpcomingSchedule } from "../../../api/dashboardApi";

const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();
const clock = (iso) => new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

// Today's doctor bookings, hospital appointments and wellness sessions.
async function loadToday() {
  const items = await getUpcomingSchedule();
  return items.filter((i) => isToday(i.at)).map((i) => ({ time: clock(i.at), title: i.title, activeSub: i.sub }));
}

export function TodaysSchedule() {
  const { data } = useApiData(loadToday, []);
  const SCHEDULE = data || [];
  return (
    <Card>
      <SectionTitle>Today's Schedule</SectionTitle>
      <div className="sabi-timeline">
        {data && !SCHEDULE.length && <div className="sabi-timeline-title">Nothing scheduled today</div>}
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

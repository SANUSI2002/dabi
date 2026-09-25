import React from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "design-system";
import { SectionTitle } from "../share";
import { useApiData } from "../../../api/useApiData";
import { getUpcomingSchedule } from "../../../api/dashboardApi";

const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();
const clock = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const dayAndClock = (iso) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Today's hospital appointments and wellness sessions; if there are none, what's coming next. */
export function TodaysSchedule() {
  const navigate = useNavigate();
  const { data, error } = useApiData(getUpcomingSchedule, []);
  const today = (data || []).filter((i) => isToday(i.at));
  const showingToday = today.length > 0;
  const items = showingToday ? today : (data || []).slice(0, 3);

  return (
    <Card>
      <SectionTitle action="All" onAction={() => navigate("/appointments")}>
        {showingToday || !data?.length ? "Today's Schedule" : "Coming Up"}
      </SectionTitle>
      {error ? (
        <p className="sabi-dash-empty">{error.message}</p>
      ) : !data ? (
        <p className="sabi-dash-empty">Loading your schedule…</p>
      ) : items.length === 0 ? (
        <p className="sabi-dash-empty">Nothing scheduled. Book a hospital visit or wellness session when you need one.</p>
      ) : (
        <div className="sabi-timeline">
          {items.map((s, i) => (
            <button type="button" className={`sabi-timeline-item sabi-timeline-link${i === 0 ? " active" : ""}`} key={s.id} onClick={() => navigate(s.to)}>
              <div className="sabi-timeline-marker">
                <span className="sabi-timeline-dot" />
                <span className="sabi-timeline-line" />
              </div>
              <div>
                <div className="sabi-timeline-time">{showingToday ? clock(s.at) : dayAndClock(s.at)}</div>
                <div className="sabi-timeline-title">{s.title}</div>
                {s.sub && <div className="sabi-timeline-sub">{s.sub}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

export default TodaysSchedule;

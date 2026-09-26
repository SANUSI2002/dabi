import React from "react";
import { Card } from "design-system";
import { CalendarCheck2, CheckCircle2, CalendarClock, CalendarX2 } from "lucide-react";

/** Counts across doctor and hospital appointments, computed from live data. */
export function StatsRow({ stats }) {
  const items = [
    { icon: CalendarCheck2, value: stats.upcoming, label: "Upcoming" },
    { icon: CalendarClock, value: stats.awaiting, label: "Awaiting Confirmation" },
    { icon: CheckCircle2, value: stats.completed, label: "Completed" },
    { icon: CalendarX2, value: stats.cancelled, label: "Cancelled / Declined" },
  ];
  return (
    <div className="sabi-apt-stats">
      {items.map((stat) => (
        <Card key={stat.label} className="sabi-apt-stat-card">
          <div className="sabi-apt-stat-icon">
            <stat.icon size={17} />
          </div>
          <div className="sabi-apt-stat-label">{stat.label.toUpperCase()}</div>
          <div className="sabi-apt-stat-value">{stat.value ?? "—"}</div>
        </Card>
      ))}
    </div>
  );
}

export default StatsRow;

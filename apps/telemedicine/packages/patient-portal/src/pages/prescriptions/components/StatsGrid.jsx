import React from "react";
import { Pill, CalendarClock, BarChart3, BellRing } from "lucide-react";

const ICONS = { Pill, CalendarClock, BarChart3, BellRing };

export function StatsGrid({ stats }) {
  return (
    <div className="sabi-rx-stats-grid">
      {stats.map((stat) => {
        const Icon = ICONS[stat.icon];
        // Danger only signals when there is something to act on: "00 renewals" is not an alert.
        const alert = stat.tone === "danger" && Number(stat.value) > 0;
        return (
          <div className="sabi-card sabi-rx-stat-card" key={stat.key}>
            <div className="sabi-rx-stat-top">
              <div className={`sabi-rx-stat-icon ${alert ? "danger" : ""}`} aria-hidden="true">
                {Icon && <Icon size={20} strokeWidth={2} />}
              </div>
              {stat.badge && <span className="sabi-rx-stat-badge">{stat.badge}</span>}
            </div>
            <div className="sabi-rx-stat-label">{stat.label}</div>
            <div className={`sabi-rx-stat-value ${alert ? "danger" : ""}`}>
              {stat.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default StatsGrid;
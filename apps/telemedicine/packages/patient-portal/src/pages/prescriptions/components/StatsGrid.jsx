import React from "react";
import { Pill, CalendarClock, BarChart3, BellRing } from "lucide-react";

const ICONS = { Pill, CalendarClock, BarChart3, BellRing };

export function StatsGrid({ stats }) {
  return (
    <div className="sabi-rx-stats-grid">
      {stats.map((stat) => {
        const Icon = ICONS[stat.icon];
        return (
          <div className="sabi-card sabi-rx-stat-card" key={stat.key}>
            <div className="sabi-rx-stat-top">
              <div className={`sabi-rx-stat-icon ${stat.tone === "danger" ? "danger" : ""}`}>
                {Icon && <Icon size={20} strokeWidth={2} />}
              </div>
              {stat.badge && <span className="sabi-rx-stat-badge">{stat.badge}</span>}
            </div>
            <div className="sabi-rx-stat-label">{stat.label.toUpperCase()}</div>
            <div className={`sabi-rx-stat-value ${stat.tone === "danger" ? "danger" : ""}`}>
              {stat.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default StatsGrid;
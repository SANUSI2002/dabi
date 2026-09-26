import React from "react";
import { Card } from "design-system";
import { APPOINTMENT_STATS } from "../data";

// `values` maps each stat label to its live count.
export function StatsRow({ values = {} }) {
  return (
    <div className="sabi-apt-stats">
      {APPOINTMENT_STATS.map((stat) => (
        <Card key={stat.label} className="sabi-apt-stat-card">
          <div className="sabi-apt-stat-icon">
            <stat.icon size={17} />
          </div>
          <div className="sabi-apt-stat-label">{stat.label.toUpperCase()}</div>
          <div className="sabi-apt-stat-value">{values[stat.label] ?? "—"}</div>
        </Card>
      ))}
    </div>
  );
}

export default StatsRow;

import React from "react";
import { Card } from "design-system";
import { APPOINTMENT_STATS } from "../data";

export function StatsRow() {
  return (
    <div className="sabi-apt-stats">
      {APPOINTMENT_STATS.map((stat) => (
        <Card key={stat.label} className="sabi-apt-stat-card">
          <div className="sabi-apt-stat-icon">
            <stat.icon size={17} />
          </div>
          <div className="sabi-apt-stat-label">{stat.label.toUpperCase()}</div>
          <div className="sabi-apt-stat-value">{stat.value}</div>
        </Card>
      ))}
    </div>
  );
}

export default StatsRow;

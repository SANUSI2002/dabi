import React from "react";
import { Card } from "design-system";
import { Folder, MessageSquare, FileEdit } from "lucide-react";

// Every count here is derived from the real records list in state — never a
// fixed placeholder — so it stays accurate as records are added or removed.
export function StatsRow({ records }) {
  const stats = [
    { icon: Folder, value: records.length, label: "Total Records" },
    { icon: MessageSquare, value: records.filter((r) => r.categoryId === "consultations").length, label: "Consultations" },
    { icon: FileEdit, value: records.filter((r) => r.categoryId == null).length, label: "Unfiled Documents" },
  ];

  return (
    <div className="sabi-stats-row">
      {stats.map((stat) => (
        <Card key={stat.label} className="sabi-stat-card">
          <div className="sabi-stat-icon">
            <stat.icon size={19} />
          </div>
          <div className="sabi-stat-value">{stat.value}</div>
          <div className="sabi-stat-label">{stat.label}</div>
        </Card>
      ))}
    </div>
  );
}

export default StatsRow;

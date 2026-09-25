import React from "react";
import { Card } from "design-system";
import { Folder, MessageSquare, FileText } from "lucide-react";
import { isVisit } from "../../../api/recordsApi";

// Every count is derived from the patient's live records and documents.
export function StatsRow({ records, documents }) {
  const stats = [
    { icon: Folder, value: records.length, label: "Total Records" },
    { icon: MessageSquare, value: records.filter(isVisit).length, label: "Consultations" },
    { icon: FileText, value: documents.length, label: "Documents" },
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

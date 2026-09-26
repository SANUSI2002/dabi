import React from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "design-system";
import { SectionTitle, ListItem } from "../share";
import { Droplet, Activity as ActivityIcon, FileText, Stethoscope, Video, ScanLine } from "lucide-react";
import { useApiData } from "../../../api/useApiData";
import { recentRecords } from "../../../api/dashboardApi";

const ICONS = { PHYSICAL: Stethoscope, VIRTUAL: Video, LAB_RESULT: Droplet, IMAGING: ScanLine, OTHER: ActivityIcon };

// The patient's most recent medical records; "view" opens the full report.
async function loadConsultations() {
  const records = await recentRecords(6);
  return records.map((r) => ({
    id: r.id,
    title: r.title,
    sub: [r.doctorName || r.facility || (r.recordType === "OTHER" ? "Medical record" : r.typeLabel), r.date].join(" · "),
    icon: ICONS[r.recordType] || FileText,
  }));
}

export function RecentConsultations() {
  const navigate = useNavigate();
  const { data } = useApiData(loadConsultations, []);
  const CONSULTATIONS = data || [];

  return (
    <Card>
      <SectionTitle>Recent Consultation</SectionTitle>
      <div>
        {data && !CONSULTATIONS.length && <div className="sabi-med-sub">No records yet — add them in Medical Records.</div>}
        {CONSULTATIONS.map((c, i) => (
          <ListItem
            key={i}
            icon={<c.icon size={17} />}
            title={c.title}
            sub={c.sub}
            showView
            trailing="›"
            onView={() => navigate(`/reports/${c.id}`)}
          />
        ))}
      </div>
    </Card>
  );
}

export default RecentConsultations;

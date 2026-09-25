import React from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "design-system";
import { FileText, FlaskConical, ScanLine, Stethoscope, Video } from "lucide-react";
import { SectionTitle, ListItem } from "../share";
import { useApiData } from "../../../api/useApiData";
import { recentRecords } from "../../../api/dashboardApi";

const ICONS = { PHYSICAL: Stethoscope, VIRTUAL: Video, LAB_RESULT: FlaskConical, IMAGING: ScanLine };

export function RecentConsultations() {
  const navigate = useNavigate();
  const { data, error } = useApiData(() => recentRecords(5), []);

  return (
    <Card>
      <SectionTitle action="All" onAction={() => navigate("/records")}>Recent Records</SectionTitle>
      {error ? (
        <p className="sabi-dash-empty">{error.message}</p>
      ) : !data ? (
        <p className="sabi-dash-empty">Loading your records…</p>
      ) : data.length === 0 ? (
        <p className="sabi-dash-empty">No records yet. Add past visits and results in Medical Records.</p>
      ) : (
        <div>
          {data.map((r) => {
            const Icon = ICONS[r.recordType] || FileText;
            return (
              <ListItem
                key={r.id}
                icon={<Icon size={17} />}
                title={r.title}
                sub={[r.facility || r.doctorName || r.typeLabel, r.date].join(" · ")}
                showView
                trailing="›"
                onView={() => navigate("/records")}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default RecentConsultations;

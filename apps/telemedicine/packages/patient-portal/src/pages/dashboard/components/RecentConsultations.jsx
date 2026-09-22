import React from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "design-system";
import { SectionTitle, ListItem } from "../share";
import { CONSULTATIONS } from "../data";

export function RecentConsultations() {
  const navigate = useNavigate();

  return (
    <Card>
      <SectionTitle>Recent Consultation</SectionTitle>
      <div>
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

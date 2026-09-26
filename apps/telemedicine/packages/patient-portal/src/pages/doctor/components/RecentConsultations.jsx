import React from "react";
import { Card } from "design-system";
import { SectionTitle, ListItem } from "../share";
import { CONSULTATIONS } from "../data";

export function RecentConsultations() {
  return (
    <Card>
      <SectionTitle>Recent Consultation</SectionTitle>
      <div>
        {CONSULTATIONS.map((c, i) => (
          <ListItem key={i} icon={c.icon} title={c.title} sub={c.sub} showView trailing="›" />
        ))}
      </div>
    </Card>
  );
}

export default RecentConsultations;

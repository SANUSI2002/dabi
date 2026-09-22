import React from "react";
import { Card } from "design-system";

export function SectionCard({ icon, title, headerRight, children }) {
  return (
    <Card className="sabi-section-card">
      <div className="sabi-section-card-head">
        <div className="sabi-section-card-title">
          {icon && <span className="sabi-section-card-icon">{icon}</span>}
          <h3>{title}</h3>
        </div>
        {headerRight}
      </div>
      {children}
    </Card>
  );
}

export default SectionCard;

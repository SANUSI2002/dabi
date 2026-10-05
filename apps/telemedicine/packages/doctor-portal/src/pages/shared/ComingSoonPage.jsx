import React from "react";
import { PageTransition } from "design-system";
import PortalLayout from "../../components/PortalLayout";
import "./ComingSoonPage.css";

export function ComingSoonPage({ title, description, Icon, placeholder = "Search..." }) {
  return (
    <PortalLayout topbarProps={{ placeholder }}>
      <PageTransition className="dp-coming-soon">
        {Icon && (
          <div className="dp-coming-soon-icon">
            <Icon size={26} />
          </div>
        )}
        <h1>{title}</h1>
        <p>{description}</p>
        <span className="dp-coming-soon-badge">In progress</span>
      </PageTransition>
    </PortalLayout>
  );
}

export default ComingSoonPage;

import React from "react";
import { Card } from "design-system";
import { SectionTitle } from "../share";
import { QUICK_ACTIONS } from "../data";

export function QuickActions() {
  return (
    <section>
      <SectionTitle>Quick Actions</SectionTitle>
      <div className="sabi-quick-grid">
        {QUICK_ACTIONS.map((a) => (
          <Card key={a.title} className="sabi-quick-card">
            <div className="sabi-quick-icon">{a.icon}</div>
            <strong className="sabi-quick-title">{a.title}</strong>
            <p className="sabi-quick-sub">{a.subtitle}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

export default QuickActions;

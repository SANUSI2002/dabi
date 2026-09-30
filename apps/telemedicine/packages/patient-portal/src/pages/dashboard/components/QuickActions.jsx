import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "design-system";
import { SectionTitle } from "../share";
import { QUICK_ACTIONS } from "../data";
import { EmergencyCardModal } from "./EmergencyCardModal";
import { SwipeRow } from "../../../ui/SwipeRow";

export function QuickActions() {
  const navigate = useNavigate();
  const [showEmergency, setShowEmergency] = useState(false);

  const handleClick = (action) => {
    if (action.action === "emergency") {
      setShowEmergency(true);
    } else if (action.to) {
      navigate(action.to);
    }
  };

  return (
    <section>
      <SectionTitle>Quick Actions</SectionTitle>
      <SwipeRow className="sabi-quick-grid" label="Quick actions">
        {QUICK_ACTIONS.map((a) => (
          <Card
            key={a.title}
            className="sabi-quick-card"
            role="button"
            tabIndex={0}
            onClick={() => handleClick(a)}
            onKeyDown={(e) => e.key === "Enter" && handleClick(a)}
          >
            <div className="sabi-quick-icon">
              <a.icon size={19} />
            </div>
            <strong className="sabi-quick-title">{a.title}</strong>
            <p className="sabi-quick-sub">{a.subtitle}</p>
          </Card>
        ))}
      </SwipeRow>

      {showEmergency && <EmergencyCardModal onClose={() => setShowEmergency(false)} />}
    </section>
  );
}

export default QuickActions;

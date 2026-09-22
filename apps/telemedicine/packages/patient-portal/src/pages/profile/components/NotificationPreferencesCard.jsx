import React from "react";
import { SectionCard, ToggleSwitch } from "../shared";
import { NOTIFICATIONS } from "../data";

export function NotificationPreferencesCard() {
  return (
    <SectionCard icon="🔔" title="Notification Preferences">
      <div className="sabi-toggle-list">
        {NOTIFICATIONS.map((n) => (
          <div className="sabi-toggle-row" key={n.key}>
            <span>{n.label}</span>
            <ToggleSwitch defaultChecked={n.checked} label={n.label} />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export default NotificationPreferencesCard;

import React from "react";
import { SectionCard, ToggleSwitch } from "../shared";

const NOTIFICATIONS = [
  { key: "appointmentReminders", label: "Appointment Reminders" },
  { key: "prescriptionAlerts", label: "Prescription Refill Alerts" },
  { key: "healthTips", label: "Health Tips & Newsletter" },
];

export function NotificationPreferencesCard({ form, set }) {
  return (
    <SectionCard icon="🔔" title="Notification Preferences">
      <div className="sabi-toggle-list">
        {NOTIFICATIONS.map((n) => (
          <div className="sabi-toggle-row" key={n.key}>
            <span>{n.label}</span>
            <ToggleSwitch checked={Boolean(form[n.key])} onChange={(e) => set(n.key, e.target.checked)} label={n.label} />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export default NotificationPreferencesCard;

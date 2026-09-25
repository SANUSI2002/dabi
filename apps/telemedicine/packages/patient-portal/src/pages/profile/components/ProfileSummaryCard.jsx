import React from "react";
import { Card } from "design-system";

const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "P";

export function ProfileSummaryCard({ name, account }) {
  return (
    <Card className="sabi-profile-summary">
      <div className="sabi-profile-avatar-wrap">
        <div className="sabi-profile-avatar" aria-hidden="true">{initials(name)}</div>
      </div>

      <div className="sabi-profile-summary-info">
        <h2>{name || "Your profile"}</h2>
        {account.patientId && <p>Patient ID {account.patientId}</p>}
        {account.email && <p>{account.email}</p>}
      </div>
    </Card>
  );
}

export default ProfileSummaryCard;

import React from "react";
import { Card } from "design-system";
import { ToggleSwitch } from "../shared";
const initialsOf = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function ProfileSummaryCard({ name, account }) {
  const PROFILE = {
    name: name || "Your profile",
    initials: initialsOf(name) || "P",
    since: account.since ? new Date(account.since).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : null,
    activeAccount: true,
  };

  return (
    <Card className="sabi-profile-summary">
      <div className="sabi-profile-avatar-wrap">
        {/* Swap for a real <img src="..." alt="..." /> once you have the asset */}
        <div className="sabi-profile-avatar">{PROFILE.initials}</div>
        <button className="sabi-profile-avatar-edit" aria-label="Change photo" type="button">
          📷
        </button>
      </div>

      <div className="sabi-profile-summary-info">
        <h2>{PROFILE.name}</h2>
        <p>{PROFILE.since ? `Patient since ${PROFILE.since}` : `Patient ${account.patientId}`}</p>
        <button className="sabi-pill-btn" type="button">
          edit profile
        </button>
      </div>

      {/* No visible label in the design for this toggle — kept an
          aria-label only, for screen readers, without rendering text.
          Confirm with the Figma what this actually controls and
          rename the aria-label accordingly. */}
      <div className="sabi-profile-summary-toggle">
        <ToggleSwitch defaultChecked={PROFILE.activeAccount} label="Active account" />
      </div>
    </Card>
  );
}

export default ProfileSummaryCard;

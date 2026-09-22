import React from "react";
import { Card } from "design-system";
import { ToggleSwitch } from "../shared";
import { PROFILE } from "../data";

export function ProfileSummaryCard() {
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
        <p>Patient since {PROFILE.since}</p>
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

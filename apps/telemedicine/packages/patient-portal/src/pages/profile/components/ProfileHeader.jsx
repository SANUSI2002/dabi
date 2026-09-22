import React from "react";
import { Button } from "design-system";

export function ProfileHeader() {
  return (
    <div className="sabi-profile-header">
      <div>
        <h1>Profile Settings</h1>
        <p>Manage your comprehensive health profile and preferences.</p>
      </div>
      <Button variant="primary">💾 Save All Changes</Button>
    </div>
  );
}

export default ProfileHeader;

import React from "react";
import { Button } from "design-system";

export function ProfileHeader({ dirty, saving, onSave }) {
  return (
    <div className="sabi-profile-header">
      <div>
        <h1>Profile Settings</h1>
        <p>Manage your comprehensive health profile and preferences.</p>
      </div>
      <Button variant="primary" onClick={onSave} disabled={!dirty || saving}>
        {saving ? "Saving…" : dirty ? "💾 Save All Changes" : "All changes saved"}
      </Button>
    </div>
  );
}

export default ProfileHeader;

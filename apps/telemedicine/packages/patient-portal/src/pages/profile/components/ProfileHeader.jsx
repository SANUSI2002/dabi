import React from "react";
import { Button } from "design-system";

export function ProfileHeader({ onSave, saving, message, onDismiss }) {
  return (
    <div className="sabi-profile-header">
      <div>
        <h1>Profile Settings</h1>
        <p>Manage your comprehensive health profile and preferences.</p>
      </div>
      <Button variant="primary" onClick={onSave} disabled={saving}>{saving ? "💾 Saving…" : "💾 Save All Changes"}</Button>
      {message ? <div className="sabi-toast" role="status" onClick={onDismiss}>{message}</div> : null}
    </div>
  );
}

export default ProfileHeader;

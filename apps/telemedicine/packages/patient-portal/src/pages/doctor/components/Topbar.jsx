import React from "react";
import { getCurrentUser } from "../../../utils/sabiIdentity";

export function Topbar() {
  const user = getCurrentUser();
  const name = user?.fullName || user?.email || "Patient";
  return (
    <div className="sabi-topbar">
      <div className="sabi-search">
        🔍
        <input type="text" placeholder="Search records, doctors, or help..." />
      </div>
      <div className="sabi-topbar-actions">
        <button className="sabi-icon-btn sabi-bell" aria-label="Notifications">
          🔔<span className="dot" />
        </button>
        <button className="sabi-icon-btn location" aria-label="Location">
          📍
        </button>
        <div className="sabi-profile">
          <div className="avatar">{name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}</div>
          <div>
            <div className="name">{name}</div>
            {user?.patientId && <div className="id">Patient {user.patientId}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Topbar;

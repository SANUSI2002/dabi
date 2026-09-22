import React from "react";

export function Topbar() {
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
          <div className="avatar">JD</div>
          <div>
            <div className="name">John Doe</div>
            <div className="id">Patient #S-2940</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Topbar;

import React from "react";
import { Link } from "react-router-dom";
import { Wallet } from "lucide-react";
import { getCurrentUser } from "../../../utils/sabiIdentity";

export function Topbar() {
  const user = getCurrentUser();
  const name = user?.fullName || user?.email || "Patient";
  return (
    <div className="sabi-topbar">
      <div className="sabi-topbar-actions">
        <Link to="/wallet" className="sabi-wallet-shortcut" aria-label="Open Sabi Wallet. Current balance unavailable.">
          <span className="sabi-wallet-shortcut-icon"><Wallet size={17} /></span>
          <span className="sabi-wallet-shortcut-copy"><span>Sabi Wallet</span><strong>₦ —</strong></span>
        </Link>
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

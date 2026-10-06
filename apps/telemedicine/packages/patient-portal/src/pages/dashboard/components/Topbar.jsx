import React, { useState, useRef, useEffect } from "react";
import { ShieldAlert, CircleHelp, LogOut, User, Wallet } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";

import { EmergencyCardModal } from "./EmergencyCardModal";
import { NotificationsBell } from "../../../notifications/NotificationsBell";
import { getCurrentUser, signOut } from "../../../utils/sabiIdentity";

export function Topbar({
  userName,
  userId,
  showHelp = false,
  onLogout,
}) {
  // Every page sits behind the session guard, so the signed-in user is already loaded.
  const user = getCurrentUser();
  userName = userName || user?.fullName || user?.email || "Patient";
  userId = userId || (user?.patientId ? `Patient ${user.patientId}` : "");
  const [showEmergencyCard, setShowEmergencyCard] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const pageTitles = {dashboard:"Overview",appointments:"Appointments",vitals:"My vitals",records:"Health records",prescriptions:"Prescriptions",wallet:"Sabi Wallet",profile:"My profile",family:"Family care","wellness-hub":"Wellness Hub","care-plans":"My care plans","pharmacy-market":"Pharmacy marketplace",hospitals:"Hospitals",insurance:"Insurance"};
  const pageTitle = pageTitles[location.pathname.split("/")[1]] || "Your care space";

  // Close dropdown when clicking outside of it
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    setShowProfileMenu(false);
    if (onLogout) {
      await onLogout();
    } else {
      await signOut();
      navigate("/login");
    }
  }

  return (
    <div className="sabi-topbar">
      <div className="sabi-topbar-context"><small>Your personal care space</small><strong>{pageTitle}</strong></div>
      <div className="sabi-topbar-actions">
        <Link to="/wallet" className="sabi-wallet-shortcut" aria-label="Open Sabi Wallet. Current balance unavailable.">
          <span className="sabi-wallet-shortcut-icon"><Wallet size={17} /></span>
          <span className="sabi-wallet-shortcut-copy"><span>Sabi Wallet</span><strong>₦ —</strong></span>
        </Link>
        {showHelp && (
          <button className="sabi-icon-btn" aria-label="Help">
            <CircleHelp />
          </button>
        )}
        <button
          className="sabi-emergency-badge"
          type="button"
          onClick={() => setShowEmergencyCard(true)}
          aria-label="Emergency — tap to view emergency ID card"
        >
          <ShieldAlert /> Emergency
        </button>
        <NotificationsBell />

        <div className="sabi-profile" ref={profileRef}>
          <button
            className="sabi-profile-trigger"
            type="button"
            onClick={() => setShowProfileMenu((prev) => !prev)}
            aria-haspopup="true"
            aria-expanded={showProfileMenu}
          >
            <div className="avatar">{userName.split(" ").map((p) => p[0]).join("").slice(0, 2)}</div>
            <div className="sabi-profile-text">
              <div className="name">{userName}</div>
              <div className="id">{userId}</div>
            </div>
          </button>

          {showProfileMenu && (
            <div className="sabi-profile-menu" role="menu">
              <Link
                to="/profile"
                className="sabi-profile-menu-item"
                role="menuitem"
                onClick={() => setShowProfileMenu(false)}
              >
                <User size={16} /> Profile
              </Link>
              <button
                className="sabi-profile-menu-item sabi-logout"
                role="menuitem"
                type="button"
                onClick={handleLogout}
              >
                <LogOut size={16} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {showEmergencyCard && <EmergencyCardModal onClose={() => setShowEmergencyCard(false)} />}
    </div>
  );
}

export default Topbar;

import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Bell, AlertTriangle, LogOut, Settings, User, CircleHelp, Menu } from "lucide-react";
import "./Topbar.css";
import { AUTH_CONFIGURED, signOutAccount } from "../services/doctorAuth";
import { signOutDoctor } from "../store/doctorSession";
import { DOCTOR_PROFILE } from "../data/doctorProfile";

export function Topbar({
  placeholder = "Search...",
  onSearch,
  notificationCount = 0,
  showAlert = false,
  children,
  title,
  profileMode = false,
  onMenuOpen,
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [signOutError, setSignOutError] = useState("");
  async function signOut() {
    try { if (AUTH_CONFIGURED) await signOutAccount(); signOutDoctor(); navigate("/login", { replace: true }); } catch { setSignOutError("Could not sign out. Please retry."); }
  }

  useEffect(() => {
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function submitSearch(e) {
    e.preventDefault();
    onSearch?.(query);
  }

  return (
    <header className="dp-topbar">
      {/* Hamburger — only visible on mobile (≤900px) */}
      <button
        type="button"
        className="dp-topbar-hamburger"
        aria-label="Open navigation"
        onClick={onMenuOpen}
      >
        <Menu size={22} />
      </button>

      {title || !onSearch ? (
        <h1 className="dp-topbar-title">{title || "Doctor workspace"}</h1>
      ) : (
        <form className="dp-topbar-search" onSubmit={submitSearch}>
          <Search size={16} className="dp-topbar-search-icon" />
          <input
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>
      )}

      <div className="dp-topbar-right">
        {children}

        {profileMode && (
          <button
            type="button"
            className="dp-topbar-icon-btn"
            aria-label="Help"
          >
            <CircleHelp size={23} />
          </button>
        )}

        <button
          type="button"
          className="dp-topbar-icon-btn"
          aria-label="Notifications"
          onClick={() => navigate("/notifications")}
        >
          <Bell size={19} />
          {notificationCount > 0 && <span className="dp-topbar-dot" />}
        </button>

        {showAlert && (
          <button
            type="button"
            className="dp-topbar-icon-btn"
            aria-label="Alerts"
            onClick={() => navigate("/notifications")}
          >
            <AlertTriangle size={19} />
          </button>
        )}

        <div className="dp-topbar-profile" ref={menuRef}>
          <button
            type="button"
            className="dp-topbar-avatar"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Profile menu"
          >
            {DOCTOR_PROFILE.initials}
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                className="dp-topbar-menu"
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              >
                <div className="dp-topbar-menu-name">{DOCTOR_PROFILE.name}</div>
                <div className="dp-topbar-menu-sub">{DOCTOR_PROFILE.specialty}</div>
                <button
                  onClick={() => { setMenuOpen(false); navigate("/profile"); }}
                >
                  <User size={15} /> View profile
                </button>
                <button
                  onClick={() => { setMenuOpen(false); navigate("/settings"); }}
                >
                  <Settings size={15} /> Settings
                </button>
                {DOCTOR_PROFILE.isDemo && <button onClick={() => { setMenuOpen(false); navigate("/register"); }}>Register a doctor account</button>}
                {signOutError && <p role="alert">{signOutError}</p>}
                <button
                  onClick={signOut}
                >
                  <LogOut size={15} /> Sign out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

export default Topbar;

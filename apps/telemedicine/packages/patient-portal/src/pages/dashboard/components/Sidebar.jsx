import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, Menu, X } from "lucide-react";
import { NavRow } from "../share";
import { FOOTER_ITEMS, NAV_ITEMS } from "../data";
import logo from "../../../assets/logo.jpeg";

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => window.localStorage.getItem("sabi-sidebar-collapsed") === "true");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("sabi-sidebar-collapsed", String(next));
      return next;
    });
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem("auth");
      localStorage.removeItem("user");
      sessionStorage.clear();
    } catch (error) {
      console.warn("Logout cleanup failed", error);
    }

    navigate("/login", { replace: true });
  };

  /*
   * Check whether a navigation item should be active.
   *
   * Example:
   * /dashboard/family
   * /dashboard/family/add
   * /dashboard/family/member/123
   *
   * will all keep Family active.
   */
  const isActive = (path) => {
    if (!path) return false;

    return (
      location.pathname === path ||
      location.pathname.startsWith(`${path}/`)
    );
  };

  return (
    <>
      <button
        type="button"
        className={`sabi-mobile-sidebar-trigger${mobileOpen ? " is-open" : ""}`}
        onClick={() => setMobileOpen((open) => !open)}
        aria-label="Open navigation menu"
        aria-expanded={mobileOpen}
      >
        {/* Icon pill — always shows Menu; trigger hides via .is-open when sidebar
            is open, so the close action is handled by sabi-sidebar-mobile-close */}
        <span className="sabi-mobile-sidebar-trigger-icon" aria-hidden="true">
          <Menu size={20} />
        </span>
        <span className="sabi-mobile-sidebar-trigger-label">Sabi Health</span>
      </button>
      {mobileOpen && <button type="button" className="sabi-sidebar-backdrop" aria-label="Close navigation menu" onClick={() => setMobileOpen(false)} />}
      <aside className={`sabi-sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>

      {/* =====================================================
          Top Section
          ===================================================== */}
      <div className="sabi-sidebar-top">

        {/* Brand Header */}
        <div className="sabi-sidebar-brand">
          <img
            src={logo}
            alt="Sabi Health Logo"
            className="sabi-sidebar-brand-icon"
            style={{ objectFit: "cover" }}
          />

          <div className="sabi-sidebar-brand-text">
            <div className="name">
              Sabi Health
            </div>

            <div className="tagline">
              YOUR TRUSTED DIGITAL HEALTH PARTNER
            </div>
          </div>
          <button
            type="button"
            className="sabi-sidebar-toggle"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            <ChevronLeft size={17} />
          </button>

          {/* Mobile-only close button — lives in the flex row so it can never
              overlap the logo. Hidden on desktop; visible when sidebar is mobile-open.
              The external fixed trigger is hidden via the .is-open CSS class. */}
          <button
            type="button"
            className="sabi-sidebar-mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>
        </div>


        {/* =================================================
            Main Navigation
            ================================================= */}
        <nav className="sabi-nav">

          {NAV_ITEMS.map((item) => (
            <NavRow
              key={item.key}
              icon={item.icon}
              label={item.label}
              to={item.to}
              active={isActive(item.to)}
              title={collapsed ? item.label : undefined}
            />
          ))}

        </nav>
      </div>


      {/* =====================================================
          Footer Navigation
          ===================================================== */}
      <div className="sabi-sidebar-footer">

        {FOOTER_ITEMS.map((item) => (
          <NavRow
            key={item.key}
            icon={item.icon}
            label={item.label}
            to={item.to}
            active={isActive(item.to)}
            danger={item.danger}
            title={collapsed ? item.label : undefined}
            onClick={
              item.key === "logout"
                ? handleLogout
                : undefined
            }
          />
        ))}

      </div>
      </aside>
    </>
  );
}

export default Sidebar;

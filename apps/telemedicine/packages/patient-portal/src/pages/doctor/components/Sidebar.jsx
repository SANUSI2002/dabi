import React from "react";
import { useLocation } from "react-router-dom";
import { ChevronLeft, Menu, LogOut, Settings } from "lucide-react";
import { NavRow } from "../share";
import { NAV_ITEMS } from "../data";
import { useSidebar } from "../../hooks/useSidebar";
import sabiLogo from "../../../assets/logo.jpeg";

export function Sidebar() {
  const location = useLocation();
  const { collapsed, toggleCollapsed, mobileOpen, openMobile, closeMobile } = useSidebar();

  return (
    <>
      {/* Hamburger trigger — shown only under 640px via shell.css */}
      <button
        type="button"
        className="sabi-mobile-sidebar-trigger"
        onClick={openMobile}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Backdrop — only rendered while the mobile drawer is open */}
      {mobileOpen && (
        <button
          type="button"
          className="sabi-sidebar-backdrop"
          onClick={closeMobile}
          aria-label="Close menu"
        />
      )}

      <aside
        className={`sabi-sidebar${collapsed ? " collapsed" : ""}${mobileOpen ? " mobile-open" : ""}`}
      >
        <div className="sabi-sidebar-top">
          <div className="sabi-sidebar-brand">
            <div className="sabi-sidebar-brand-icon">
              <img src={sabiLogo} alt="Sabi Health logo" width={24} height={24} />
            </div>

            <div className="sabi-sidebar-brand-text">
              <div className="name">SABI</div>
              <div className="tagline">Health</div>
            </div>

            {/* Desktop/tablet collapse toggle. shell.css repositions this
                to the sidebar's right edge automatically when collapsed,
                so no conditional styling is needed here. */}
            <button
              type="button"
              className="sabi-sidebar-toggle"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
            >
              <ChevronLeft size={16} />
            </button>
          </div>

          <nav className="sabi-nav sabi-nav-large">
            {NAV_ITEMS.map((item) => (
              <NavRow
                key={item.key}
                icon={item.icon}
                label={item.label}
                to={item.to}
                active={!!item.to && location.pathname === item.to}
                onNavigate={closeMobile}
              />
            ))}
          </nav>
        </div>

        <div className="sabi-sidebar-footer sabi-sidebar-footer-large">
          <NavRow
            icon={Settings}
            label="Settings"
            to="/profile"
            active={location.pathname === "/profile"}
            onNavigate={closeMobile}
          />
          <NavRow icon={LogOut} label="Logout" danger />
        </div>
      </aside>
    </>
  );
}

export default Sidebar;

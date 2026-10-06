import React, { useState, useCallback } from "react";
import PortalAssistant from "./PortalAssistant";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import "./PortalLayout.css";
import "./PatientAlignedTheme.css";
import { getCurrentDoctor } from "../store/doctorSession";
import PageBanner from "../../../shared-portal/PageBanner";

/** Read the saved collapsed preference from localStorage (returns false if unavailable). */
function readCollapsedPref() {
  try {
    return localStorage.getItem("dp-sidebar-collapsed") === "true";
  } catch {
    return false;
  }
}

export function PortalLayout({ topbarProps = {}, assistantContext = null, children }) {
  // Mobile drawer open/close
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Desktop collapse/expand — persisted to localStorage
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readCollapsedPref);

  const openSidebar  = useCallback(() => setSidebarOpen(true),  []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const toggleCollapsed = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("dp-sidebar-collapsed", String(next));
      } catch {
        /* localStorage unavailable — session-only state is fine */
      }
      return next;
    });
  }, []);

  return (
    <div className="dp-shell">
      {/* Dim overlay behind mobile drawer */}
      {sidebarOpen && (
        <div
          className="dp-sidebar-overlay"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <Sidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={toggleCollapsed}
      />

      <div className="dp-shell-main">
        <Topbar {...topbarProps} onMenuOpen={openSidebar} />
        {getCurrentDoctor()?.isDemo && <div className="dp-preview-banner" role="status">Doctor portal preview · Sample patients and appointments</div>}
        <div className="dp-shell-content"><PageBanner audience="doctor" professionType={getCurrentDoctor()?.professionType}/>{children}</div>
        {getCurrentDoctor()?.isDemo && <PortalAssistant scope={assistantContext} />}
      </div>
    </div>
  );
}

export default PortalLayout;

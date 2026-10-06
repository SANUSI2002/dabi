import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutGrid,
  Calendar,
  CalendarCheck,
  Users,
  Video,
  ClipboardEdit,
  BarChart3,
  MessageSquare,
  Building2,
  Wallet,
  Star,
  Bell,
  User,
  Settings as SettingsIcon,
  Stethoscope,
  X,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import "./Sidebar.css";
import logo from '../../../patient-portal/src/assets/logo.jpeg';

/* ─── Navigation items ───────────────────────────────────────── */
const NAV_ITEMS = [
  { to: "/dashboard",          label: "Dashboard",          icon: LayoutGrid    },
  { to: "/calendar",           label: "Calendar",           icon: Calendar      },
  { to: "/availability",       label: "Manage Availability", icon: CalendarCheck },
  { to: "/appointments",       label: "Appointments",       icon: CalendarCheck },
  { to: "/patients",           label: "Patients",           icon: Users         },
  { to: "/consultations",      label: "Consultations",      icon: Video         },
  { to: "/prescriptions",      label: "Prescriptions",      icon: ClipboardEdit },
  { to: "/reports",            label: "Reports",            icon: BarChart3     },
  { to: "/messages",           label: "Messages",           icon: MessageSquare },
  { to: "/hospital-workspace", label: "Hospital Workspace", icon: Building2     },
  { to: "/earnings",           label: "Earnings",           icon: Wallet        },
  { to: "/reviews",            label: "Reviews",            icon: Star          },
  { to: "/notifications",      label: "Notifications",      icon: Bell          },
];

/* ─── Sidebar component ─────────────────────────────────────── */
export function Sidebar({ isOpen, onClose, isCollapsed, onToggleCollapse }) {
  const location = useLocation();

  /**
   * Active-state helper for main nav items.
   * Uses startsWith so sub-routes (e.g. /appointments/123) stay highlighted.
   */
  function isRouteActive(to) {
    return (
      location.pathname === to ||
      location.pathname.startsWith(`${to}/`)
    );
  }

  /**
   * Exact-match helper for footer items (Profile / Settings).
   * These have no sub-routes so an exact match is correct and avoids
   * false positives.
   */
  function isExactActive(to) {
    return location.pathname === to;
  }

  const sidebarClass = [
    "dp-sidebar",
    isOpen      ? "dp-sidebar-open"      : "",
    isCollapsed ? "dp-sidebar-collapsed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const isProfileActive  = isExactActive("/profile");
  const isSettingsActive = isExactActive("/settings");

  return (
    <aside className={sidebarClass}>
      {/* ── Mobile close button (visible only ≤900px via CSS) ─── */}
      <button
        className="dp-sidebar-close"
        onClick={onClose}
        aria-label="Close navigation"
      >
        <X size={20} />
      </button>

      {/* ── Brand + desktop collapse toggle ─────────────────── */}
      <div className="dp-sidebar-brand">
        <img className="dp-sidebar-brand-icon" src={logo} alt="Sabi Health" />

        <div className="dp-sidebar-brand-text">
          <div className="dp-sidebar-brand-name">Sabi Health</div>
          <div className="dp-sidebar-brand-sub">YOUR TRUSTED DIGITAL HEALTH PARTNER</div>
        </div>

        {/* Collapse/expand toggle — hidden on mobile (≤900px) via CSS */}
        <button
          className="dp-sidebar-toggle"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed
            ? <ChevronsRight size={15} />
            : <ChevronsLeft  size={15} />
          }
        </button>
      </div>

      {/* ── Main navigation ──────────────────────────────────── */}
      <nav className="dp-sidebar-nav" aria-label="Main navigation">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const active = isRouteActive(to);
          return (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              /* title shows native tooltip when sidebar is collapsed */
              title={label}
              aria-label={label}
              data-label={label}
              className={`dp-sidebar-link${active ? " dp-sidebar-link-active" : ""}`}
            >
              {/* Framer-motion animated active indicator (shared layoutId) */}
              {active && (
                <motion.span
                  layoutId="dp-sidebar-active-indicator"
                  className="dp-sidebar-active-indicator"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <Icon
                size={18}
                style={{ position: "relative", zIndex: 1, flexShrink: 0 }}
              />
              <span style={{ position: "relative", zIndex: 1 }}>{label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* ── Footer: Profile + Settings ───────────────────────── */}
      <div className="dp-sidebar-footer">
        {/*
          Profile link.
          BUG FIX: the base class (dp-sidebar-profile) must NOT carry
          the teal background unconditionally.  Active appearance is
          supplied ONLY by dp-sidebar-profile-active, which is added
          dynamically when location.pathname === "/profile".
        */}
        <NavLink
          to="/profile"
          onClick={onClose}
          title="Profile"
          aria-label="Profile"
          data-label="Profile"
          className={
            `dp-sidebar-profile${isProfileActive ? " dp-sidebar-profile-active" : ""}`
          }
        >
          <User
            size={18}
            style={{ position: "relative", zIndex: 1, flexShrink: 0 }}
          />
          <span style={{ position: "relative", zIndex: 1 }}>Profile</span>
        </NavLink>

        {/* Settings link — uses the standard link + active classes */}
        <NavLink
          to="/settings"
          onClick={onClose}
          title="Settings"
          aria-label="Settings"
          data-label="Settings"
          className={
            `dp-sidebar-link${isSettingsActive ? " dp-sidebar-link-active" : ""}`
          }
        >
          {isSettingsActive && (
            <motion.span
              layoutId="dp-sidebar-active-indicator"
              className="dp-sidebar-active-indicator"
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            />
          )}
          <SettingsIcon
            size={18}
            style={{ position: "relative", zIndex: 1, flexShrink: 0 }}
          />
          <span style={{ position: "relative", zIndex: 1 }}>Settings</span>
        </NavLink>
      </div>
    </aside>
  );
}

export default Sidebar;

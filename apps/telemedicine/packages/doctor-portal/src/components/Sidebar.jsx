import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
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
  History,
} from "lucide-react";
import "./Sidebar.css";
import logo from '../../../patient-portal/src/assets/logo.jpeg';
import {getCurrentDoctor} from '../store/doctorSession';

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
  const professional = getCurrentDoctor();
  const doctor = professional?.isDemo || professional?.professionType === 'DOCTOR';
  const reduceMotion = useReducedMotion();
  // Live portals group the same pages by task. Doctors keep every page; other professionals keep
  // the shared pages plus their own care workspace. The preview build keeps its single list.
  const careLink = { to: '/care-workspace', label: professional?.capabilities?.nutrition ? 'Dietician Table' : professional?.professionType === 'COUNSELLOR' ? 'Counselling care' : professional?.professionType === 'PSYCHOLOGIST' ? 'Psychology care' : 'Care plans', icon: ClipboardEdit };
  const pick = (paths) => paths.map((to) => NAV_ITEMS.find((item) => item.to === to));
  const groups = professional?.isDemo ? [{ label: 'Your practice', items: NAV_ITEMS }] : [
    { label: 'Your day', items: pick(['/dashboard', '/appointments', '/consultations', '/notifications']) },
    { label: 'Schedule', items: pick(['/calendar', '/availability']) },
    { label: 'Patients & care', items: doctor ? pick(['/patients', '/prescriptions', '/reports']) : [careLink] },
    ...(doctor ? [{ label: 'Practice', items: pick(['/messages', '/hospital-workspace', '/earnings', '/reviews']) }] : []),
  ];

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
          <div className="dp-sidebar-brand-sub">YOUR PROFESSIONAL WORKSPACE</div>
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
        {groups.map((group) => <div className="dp-nav-group" key={group.label}>
          <div className="dp-nav-caption">{group.label}</div>
          {group.items.map(({ to, label, icon: Icon }) => {
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
                {active && (
                  <motion.span
                    layoutId="dp-sidebar-active-indicator"
                    className="dp-sidebar-active-indicator"
                    transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <Icon size={18} aria-hidden="true" style={{ position: "relative", zIndex: 1, flexShrink: 0 }} />
                <span style={{ position: "relative", zIndex: 1 }}>{label}</span>
              </NavLink>
            );
          })}
        </div>)}
      </nav>

      {/* ── Footer: Profile + Settings ───────────────────────── */}
      <div className="dp-sidebar-footer"><div className="dp-nav-caption">Account</div>
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

        {/* Activity log (live accounts): sign-ins and every patient record opened or changed. */}
        {!professional?.isDemo && <NavLink
          to="/activity"
          onClick={onClose}
          title="Activity log"
          aria-label="Activity log"
          data-label="Activity log"
          className={`dp-sidebar-link${isRouteActive("/activity") ? " dp-sidebar-link-active" : ""}`}
        >
          {isRouteActive("/activity") && (
            <motion.span
              layoutId="dp-sidebar-active-indicator"
              className="dp-sidebar-active-indicator"
              transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
            />
          )}
          <History size={18} style={{ position: "relative", zIndex: 1, flexShrink: 0 }} />
          <span style={{ position: "relative", zIndex: 1 }}>Activity log</span>
        </NavLink>}

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
              transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
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

// Shared React primitives for the telemedicine portals. Styling lives in components.css; these
// components only add structure, semantics and keyboard behaviour so every screen states its
// status, loading, empty and error conditions the same way.
import React, { useRef } from "react";
import { AlertTriangle, CheckCircle2, Info, Inbox, RefreshCw, XCircle } from "lucide-react";

const cx = (...parts) => parts.filter(Boolean).join(" ");

/** Appointment, prescription and care-plan statuses mapped to a tone and patient-friendly wording. */
const STATUS = {
  REQUESTED: ["warning", "Awaiting confirmation"],
  PENDING: ["warning", "Pending"],
  CONFIRMED: ["success", "Confirmed"],
  ACTIVE: ["success", "Active"],
  ISSUED: ["success", "Issued"],
  PUBLISHED: ["success", "Published"],
  OPEN: ["success", "Open"],
  BOOKED: ["info", "Booked"],
  DRAFT: ["neutral", "Draft"],
  COMPLETED: ["neutral", "Completed"],
  ARCHIVED: ["neutral", "Archived"],
  EXPIRED: ["neutral", "Expired"],
  DECLINED: ["danger", "Declined"],
  CANCELLED: ["danger", "Cancelled"],
  REVOKED: ["danger", "Revoked"],
};

/** `labels` lets a portal reword a status for its audience (e.g. professionals see "Needs response"). */
export function StatusBadge({ status, labels = {}, className }) {
  const [tone, label] = STATUS[status] || ["neutral", String(status || "Unknown").toLowerCase().replaceAll("_", " ")];
  return <span className={cx("sx-badge", `sx-badge-${tone}`, className)}>{labels[status] || label}</span>;
}

const NOTICE_ICON = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle };
/** Inline alert. Errors are announced assertively; everything else politely. */
export function Notice({ tone = "info", title, children, className }) {
  const Icon = NOTICE_ICON[tone] || Info;
  return <div className={cx("sx-notice", `sx-notice-${tone}`, className)} role={tone === "danger" ? "alert" : "status"}>
    <Icon size={18} aria-hidden="true" />
    <div>{title && <strong>{title}</strong>}{children}</div>
  </div>;
}

export function LoadingState({ label = "Loading…", className }) {
  return <div className={cx("sx-state", className)} role="status" aria-live="polite"><span className="sx-spinner" aria-hidden="true" /><p>{label}</p></div>;
}

export function EmptyState({ icon: Icon = Inbox, title, children, action, className }) {
  return <div className={cx("sx-state", className)}>
    <span className="sx-state-icon" aria-hidden="true"><Icon size={22} /></span>
    <h3>{title}</h3>
    {children && <p>{children}</p>}
    {action}
  </div>;
}

export function ErrorState({ title = "Something went wrong", message, onRetry, className }) {
  return <div className={cx("sx-state sx-state-error", className)} role="alert">
    <span className="sx-state-icon" aria-hidden="true"><AlertTriangle size={22} /></span>
    <h3>{title}</h3>
    {message && <p>{message}</p>}
    {onRetry && <button type="button" className="sx-btn sx-btn-secondary sx-btn-sm" onClick={onRetry}><RefreshCw size={15} aria-hidden="true" /> Try again</button>}
  </div>;
}

export function PageHeader({ eyebrow, title, description, actions, className }) {
  return <header className={cx("sx-page-header", className)}>
    <div>{eyebrow && <span className="sx-eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>
    {actions && <div className="sx-actions">{actions}</div>}
  </header>;
}

/** A compact calendar date (e.g. "OCT / 7") for lists of appointments. */
export function DateTile({ value }) {
  const date = new Date(value);
  return <span className="sx-date-tile" aria-hidden="true"><small>{date.toLocaleDateString(undefined, { month: "short" })}</small><strong>{date.getDate()}</strong></span>;
}

/**
 * Accessible tab list used as a filter: arrow keys, Home and End move between tabs (roving tabindex),
 * and exactly one tab is in the tab order (the selected one, or the first when none is selected).
 * `tabs` = [{ id, label, count? }].
 */
export function Tabs({ tabs, value, onChange, label, className }) {
  const refs = useRef([]);
  const index = Math.max(0, tabs.findIndex((tab) => tab.id === value));
  const move = (next) => { const target = (next + tabs.length) % tabs.length; onChange(tabs[target].id); refs.current[target]?.focus(); };
  const onKeyDown = (event) => {
    const keys = { ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: tabs.length - 1 };
    if (event.key in keys) { event.preventDefault(); move(keys[event.key]); }
  };
  return <div className={cx("sx-tabs", className)} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
    {tabs.map((tab, i) => <button key={tab.id} ref={(el) => { refs.current[i] = el; }} type="button" role="tab" aria-selected={tab.id === value} tabIndex={i === index ? 0 : -1} className="sx-tab" onClick={() => onChange(tab.id)}>
      {tab.label}{typeof tab.count === "number" && <span className="sx-tab-count">{tab.count}</span>}
    </button>)}
  </div>;
}

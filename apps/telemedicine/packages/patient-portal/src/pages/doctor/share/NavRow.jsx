import React from "react";
import { Link } from "react-router-dom";

/**
 * `icon` is expected to be a lucide-react component (e.g. `Home`, `Settings`),
 * not an emoji string — shell.css sizes/colors nav icons via
 * `.sabi-nav-row svg`, which only targets real <svg> elements.
 *
 * `data-tooltip` is what powers the collapsed-state tooltip in shell.css
 * (`.sabi-nav-row[data-tooltip]::after`), so every row carries it regardless
 * of collapse state — the CSS decides when it's actually visible.
 */
export function NavRow({ icon: Icon, label, active, danger, to, onNavigate }) {
  const classes = ["sabi-nav-row", active ? "active" : "", danger ? "danger" : ""]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {Icon && <Icon aria-hidden="true" />}
      <span className="sabi-nav-label">{label}</span>
    </>
  );

  // No route yet (page not built) — render as a plain, non-navigating row
  // so the link doesn't 404. Once that page exists, just add its `to`.
  if (!to) {
    return (
      <div className={classes} data-tooltip={label} tabIndex={0}>
        {content}
      </div>
    );
  }

  return (
    <Link to={to} className={classes} data-tooltip={label} onClick={onNavigate}>
      {content}
    </Link>
  );
}

export default NavRow;

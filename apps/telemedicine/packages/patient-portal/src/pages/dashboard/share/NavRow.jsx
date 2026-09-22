import React from "react";
import { Link } from "react-router-dom";

export function NavRow({ icon: Icon, label, active, danger, to, onClick, title }) {
  const classes = ["sabi-nav-row", active ? "active" : "", danger ? "danger" : ""]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {Icon && <Icon size={18} strokeWidth={2} />}
      <span className="sabi-nav-label">{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} title={title} data-tooltip={label}>
        {content}
      </button>
    );
  }
  if (!to) {
    return <div className={classes} title={title} data-tooltip={label}>{content}</div>;
  }

  return (
    <Link to={to} className={classes} title={title} data-tooltip={label}>
      {content}
    </Link>
  );
}

export default NavRow;

import React from "react";

export function SectionTitle({ children, action, center, eyebrow }) {
  const classes = ["sabi-section-title", center ? "center" : "", eyebrow ? "eyebrow" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes}>
      {children}
      {action && <span className="action">{action}</span>}
    </div>
  );
}

export default SectionTitle;

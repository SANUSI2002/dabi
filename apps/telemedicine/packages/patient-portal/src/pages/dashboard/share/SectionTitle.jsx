import React from "react";

export function SectionTitle({
  children,
  action,
  onAction,
  center,
  eyebrow
}) {

  const classes = [
    "sabi-section-title",
    center ? "center" : "",
    eyebrow ? "eyebrow" : ""
  ]
    .filter(Boolean)
    .join(" ");


  return (
    <div className={classes}>

      {children}


      {action && (
        <button
          type="button"
          className="action"
          onClick={onAction}
        >
          {action}
        </button>
      )}

    </div>
  );
}

export default SectionTitle;
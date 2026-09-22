import React from "react";
import { colors, radius, font } from "./tokens";

/**
 * Shared button used across all portals.
 * variant: "primary" | "secondary" | "outline" | "danger"
 */
export function Button({ children, variant = "primary", onClick, ...props }) {
  const styles = {
    primary: {
      background: colors.primary,
      color: "#FFFFFF",
      border: "none",
    },
    secondary: {
      background: colors.surface,
      color: colors.primary,
      border: `1px solid ${colors.border}`,
    },
    outline: {
      background: colors.surface,
      color: colors.primary,
      border: `1px solid ${colors.primary}`,
    },
    danger: {
      background: colors.danger,
      color: "#FFFFFF",
      border: "none",
    },
  };

  return (
    <button
      onClick={onClick}
      style={{
        ...styles[variant],
        fontFamily: font.family,
        fontSize: font.sizeBody,
        padding: "12px 20px",
        borderRadius: radius.md,
        cursor: "pointer",
        fontWeight: 500,
      }}
      {...props}
    >
      {children}
    </button>
  );
}

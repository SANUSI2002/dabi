import React from "react";
import { colors, radius, spacing } from "./tokens";

/**
 * Shared card container used across all portals
 * (e.g. Quick Action cards, Vital History cards).
 */
export function Card({ children, style = {}, className, ...props }) {
  // If the consumer applies a page-specific `sabi-` class, prefer CSS
  // from that class for visual styling (so the page stylesheet can
  // fully control background, border, radius, etc.). Otherwise fall
  // back to design-system defaults.
  const isPageStyled = typeof className === "string" && className.includes("sabi-");

  const defaultStyle = isPageStyled
    ? {}
    : {
        background: colors.surface,
        borderRadius: radius.lg,
        padding: spacing.lg,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      };

  return (
    <div className={className} style={{ ...defaultStyle, ...style }} {...props}>
      {children}
    </div>
  );
}

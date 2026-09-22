import { colors, spacing, radius, font } from "design-system";

// The same --sabi-* custom properties every top-level page sets on its
// root element from the design-system tokens. Pulled into one place so
// adding/changing a token (or the zoom level) doesn't mean editing every
// page file individually.
export const pageVars = {
  "--sabi-primary-dark": colors.primaryDark,
  "--sabi-primary": colors.primary,
  "--sabi-primary-light": colors.primaryLight,
  "--sabi-background": colors.background,
  "--sabi-surface": colors.surface,
  "--sabi-text-primary": colors.textPrimary,
  "--sabi-text-secondary": colors.textSecondary,
  "--sabi-border": colors.border,
  "--sabi-success": colors.success,
  "--sabi-warning": colors.warning,
  "--sabi-danger": colors.danger,
  "--sabi-space-xs": spacing.xs,
  "--sabi-space-sm": spacing.sm,
  "--sabi-space-md": spacing.md,
  "--sabi-space-lg": spacing.lg,
  "--sabi-space-xl": spacing.xl,
  "--sabi-radius-sm": radius.sm,
  "--sabi-radius-md": radius.md,
  "--sabi-radius-lg": radius.lg,
  "--sabi-font-family": font.family,
  "--sabi-font-size-body": font.sizeBody,
  "--sabi-font-size-heading": font.sizeHeading,
  "--sabi-font-size-large": font.sizeLarge,
};

export default pageVars;

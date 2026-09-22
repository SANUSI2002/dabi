import React from "react";
import { colors, spacing, radius, font } from "design-system";
import "./Dashboard.css";

import {
  Sidebar,
  Topbar,
  HeroCard,
  QuickActions,
  VitalHistory,
  RecentConsultations,
  HealthScoreCard,
  EmergencyCard,
  TodaysSchedule,
  MedicationsCard,
  FamilyHealthCard,
  InsightCard,
} from "./components";
import { EMERGENCY } from "./data";

const cssVars = {
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

export function Dashboard() {
  return (
    <div className="sabi-dashboard" style={cssVars}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar />

        <div className="sabi-grid">
          <div className="sabi-col">
            <HeroCard />
            <QuickActions />
            <VitalHistory />
            <RecentConsultations />
          </div>

          <div className="sabi-col">
            <HealthScoreCard score={91} trend="+2.4% Improving" />
            <EmergencyCard blood={EMERGENCY.blood} genotype={EMERGENCY.genotype} />
            <TodaysSchedule />
            <MedicationsCard />
            <FamilyHealthCard />
            <InsightCard />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

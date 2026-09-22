import React from "react";
import { colors, spacing, radius, font } from "design-system";
import "../../styles/share.css";
import "./Profile.css";
import { useZoom } from "../../hooks/useZoom";

import { Sidebar, Topbar } from "../dashboard/components";

import {
  ProfileHeader,
  ProfileSummaryCard,
  PersonalInformationCard,
  MedicalHistoryCard,
  AllergiesMedicationsCard,
  LifestyleInformationCard,
  NotificationPreferencesCard,
  ConsentPrivacyCard,
  EmergencyAccessCard,
  SecurityCard,
  DangerZoneCard,
} from "./components";

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

export function Profile() {
  const [zoom] = useZoom();

  return (
    <div className="sabi-dashboard" style={{ ...cssVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar />

        <div className="sabi-profile-page">
          <ProfileHeader />
          <ProfileSummaryCard />

          <div className="sabi-grid sabi-profile-grid">
            <div className="sabi-col">
              <PersonalInformationCard />
              <AllergiesMedicationsCard />
              <NotificationPreferencesCard />
            </div>
            <div className="sabi-col">
              <MedicalHistoryCard />
              <LifestyleInformationCard />
              <ConsentPrivacyCard />
              <EmergencyAccessCard />
            </div>
          </div>

          <SecurityCard />
          <DangerZoneCard />
        </div>
      </div>
    </div>
  );
}

export default Profile;

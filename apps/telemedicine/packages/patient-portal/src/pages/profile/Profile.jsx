import React, { useEffect, useState } from "react";
import { colors, spacing, radius, font } from "design-system";
import "../../styles/share.css";
import "./Profile.css";
import { useZoom } from "../../hooks/useZoom";

import { Sidebar, Topbar } from "../dashboard/components";
import { useApiData } from "../../api/useApiData";
import { changedKeys, getProfile, saveProfile, validate } from "../../api/profileApi";
import { updateCurrentUser } from "../../utils/sabiIdentity";

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
  const loaded = useApiData(getProfile, []);
  // `saved` is the server's copy; `form` is what the patient is editing.
  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState(null);
  const [account, setAccount] = useState({ email: "", patientId: "", since: null });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!loaded.data) return;
    setSaved(loaded.data.form);
    setForm(loaded.data.form);
    setAccount(loaded.data.account);
  }, [loaded.data]);

  const dirty = form && saved ? changedKeys(form, saved).length > 0 : false;

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 2400);
    return () => window.clearTimeout(timer);
  }, [message]);

  // Warn before a reload or tab close would throw away unsaved edits.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form || saving) return;
    if (!dirty) {
      setMessage("Your profile is already up to date.");
      return;
    }
    const errors = Object.values(validate(form, saved)).filter(Boolean);
    if (errors.length) {
      setMessage(errors.join(" "));
      return;
    }
    setSaving(true);
    try {
      const result = await saveProfile(form, saved);
      setSaved(result.form);
      setForm(result.form);
      updateCurrentUser({ fullName: result.form.fullName });
      setMessage("✅ Your profile has been saved.");
    } catch (err) {
      setMessage(err.errors?.map((e) => e.message).join(" ") || err.message);
    } finally {
      setSaving(false);
    }
  };

  // Emergency Access has its own Save button; it saves just that setting.
  const saveEmergencyAccess = async (values) => {
    const result = await saveProfile({ ...saved, emergencyAccess: values }, saved);
    setSaved(result.form);
    setForm((f) => ({ ...f, emergencyAccess: result.form.emergencyAccess }));
  };

  const cardProps = { form, set };

  return (
    <div className="sabi-dashboard" style={{ ...cssVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar />

        <div className="sabi-profile-page">
          <ProfileHeader onSave={save} saving={saving} message={message} onDismiss={() => setMessage("")} />
          {!form && <p>{loaded.error ? "We couldn't load your profile. Please refresh to try again." : "Loading your profile…"}</p>}
          {form && <ProfileSummaryCard name={saved.fullName} account={account} />}

          {form && <div className="sabi-grid sabi-profile-grid">
            <div className="sabi-col">
              <PersonalInformationCard {...cardProps} account={account} />
              <AllergiesMedicationsCard {...cardProps} />
              <NotificationPreferencesCard {...cardProps} />
            </div>
            <div className="sabi-col">
              <MedicalHistoryCard {...cardProps} />
              <LifestyleInformationCard {...cardProps} />
              <ConsentPrivacyCard {...cardProps} />
              <EmergencyAccessCard savedValues={saved.emergencyAccess} onSave={saveEmergencyAccess} />
            </div>
          </div>}

          <SecurityCard />
          <DangerZoneCard />
        </div>
      </div>
    </div>
  );
}

export default Profile;

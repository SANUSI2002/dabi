import React, { useEffect, useState } from "react";
import { Button, colors, spacing, radius, font } from "design-system";
import "../../styles/share.css";
import "./Profile.css";
import { useZoom } from "../../hooks/useZoom";

import { Sidebar, Topbar } from "../dashboard/components";
import { LoadState } from "../hospitals/hospitalShared";
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
  EmergencyContactCard,
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
  const [account, setAccount] = useState({ email: "", patientId: "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // { tone: "good" | "bad", text }

  useEffect(() => {
    if (!loaded.data) return;
    setSaved(loaded.data.form);
    setForm(loaded.data.form);
    setAccount(loaded.data.account);
  }, [loaded.data]);

  const dirty = form && saved ? changedKeys(form, saved).length > 0 : false;

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

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
    setStatus(null);
  };

  const save = async () => {
    const found = validate(form, saved);
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      setStatus({ tone: "bad", text: "Please fix the highlighted fields." });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const result = await saveProfile(form, saved);
      setSaved(result.form);
      setForm(result.form);
      updateCurrentUser({ fullName: result.form.fullName });
      setStatus({ tone: "good", text: "Your profile has been saved." });
    } catch (err) {
      const fieldMessages = err.errors?.map((e) => e.message).join(" ");
      setStatus({ tone: "bad", text: fieldMessages || err.message });
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setForm(saved);
    setErrors({});
    setStatus(null);
  };

  const cardProps = form ? { form, set, errors } : null;

  return (
    <div className="sabi-dashboard" style={{ ...cssVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar />

        <div className="sabi-profile-page">
          <ProfileHeader dirty={dirty} saving={saving} onSave={save} />

          <LoadState loading={!form && !loaded.error} error={loaded.error} onRetry={loaded.reload} label="Loading your profile…">
            {cardProps && (
              <>
                <ProfileSummaryCard name={saved.fullName} account={account} />
                {status && !dirty && (
                  <p className={`sabi-profile-status ${status.tone}`} role="status">{status.text}</p>
                )}

                <div className="sabi-grid sabi-profile-grid">
                  <div className="sabi-col">
                    <PersonalInformationCard {...cardProps} account={account} />
                    <AllergiesMedicationsCard {...cardProps} />
                    <EmergencyContactCard {...cardProps} />
                    <NotificationPreferencesCard {...cardProps} />
                  </div>
                  <div className="sabi-col">
                    <MedicalHistoryCard {...cardProps} />
                    <LifestyleInformationCard {...cardProps} />
                    <ConsentPrivacyCard {...cardProps} />
                    <EmergencyAccessCard {...cardProps} />
                  </div>
                </div>
              </>
            )}
          </LoadState>

          <SecurityCard />
          <DangerZoneCard />
        </div>

        {dirty && (
          <div className="sabi-profile-savebar" role="region" aria-label="Unsaved changes">
            <span className={status?.tone === "bad" ? "error" : undefined}>{status?.tone === "bad" ? status.text : "You have unsaved changes."}</span>
            <div>
              <Button type="button" variant="secondary" onClick={discard} disabled={saving}>
                Discard
              </Button>
              <Button type="button" variant="primary" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Profile;

import React, { useEffect, useMemo, useState } from "react";
import { SectionCard } from "../shared";
import { EMERGENCY_ACCESS_RECORDS, clearEmergencyAccessDraft, getEmergencyAccessDraft, saveEmergencyAccessDraft, toSettings, toValues } from "../emergencyAccessStore";

/* Settings > Privacy: hospitals only receive record categories the patient has explicitly saved. */
export function EmergencyAccessCard({ savedValues, onSave }) {
  const savedSettings = useMemo(() => toSettings(savedValues), [savedValues]);
  const [draft, setDraft] = useState(() => getEmergencyAccessDraft(savedSettings));
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const hasUnsavedChanges = useMemo(() => JSON.stringify(draft) !== JSON.stringify(savedSettings), [draft, savedSettings]);

  useEffect(() => {
    const warnBeforeExit = (event) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warnBeforeExit);
    return () => window.removeEventListener("beforeunload", warnBeforeExit);
  }, [hasUnsavedChanges]);

  const updateRecord = (key) => {
    setDraft((current) => {
      const next = { ...current, [key]: !current[key] };
      saveEmergencyAccessDraft(next);
      return next;
    });
    setSavedMessage("");
    setSaveError("");
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(toValues(draft));
      clearEmergencyAccessDraft();
      setSaveError("");
      setSavedMessage("Emergency access preferences saved.");
    } catch {
      setSaveError("We couldn't save your preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard icon="🚨" title="Emergency Access">
      <p className="sabi-emergency-access-intro">Choose which records verified hospitals can access when you need emergency care.</p>
      <div className="sabi-consent-list">
        {EMERGENCY_ACCESS_RECORDS.map((record) => (
          <label className="sabi-consent-row" key={record.key}>
            <span className="sabi-consent-box">
              <input type="checkbox" checked={draft[record.key]} onChange={() => updateRecord(record.key)} />
              <span className="sabi-consent-check">✓</span>
            </span>
            <span><span className="sabi-consent-title">{record.label}</span><span className="sabi-consent-desc">{record.description}</span></span>
          </label>
        ))}
      </div>
      <div className="sabi-emergency-access-footer">
        <span className={saveError ? "error" : hasUnsavedChanges ? "unsaved" : "saved"}>{saveError || (hasUnsavedChanges ? "Unsaved changes are kept while you continue." : savedMessage || "Your preferences are up to date.")}</span>
        <button type="button" className="sabi-btn-primary" disabled={!hasUnsavedChanges || saving} onClick={save}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </SectionCard>
  );
}

export default EmergencyAccessCard;

import React from "react";
import { Check, FileText, ClipboardList, Calendar, Activity, TestTube, MessageSquare, Wallet } from "lucide-react";
import { PERMISSION_LEVELS, EMERGENCY_ONLY_LEVEL, ACCESS_KEYS } from "./data";

const ACCESS_ICONS = {
  medicalRecords: FileText,
  prescriptions: ClipboardList,
  appointments: Calendar,
  vitals: Activity,
  labResults: TestTube,
  messaging: MessageSquare,
  healthWallet: Wallet,
};

// Reused by AddMemberPage (setting access before inviting/generating a
// QR, or before requesting to join someone else's circle), and
// MemberProfilePage's Permissions tab (editing an existing member).
export function PermissionAccessPicker({ levelId, access, onSelectLevel, onToggleAccess, compact = false }) {
  return (
    <div className={compact ? "" : "sabi-fam-join-layout"}>
      <div>
        <div className="sabi-fam-perm-grid">
          {PERMISSION_LEVELS.map((level) => {
            const Icon = level.icon;
            const selected = levelId === level.id;
            return (
              <div
                key={level.id}
                className={`sabi-fam-perm-card ${selected ? "selected" : ""}`}
                onClick={() => onSelectLevel(level.id)}
              >
                {selected && <span className="check"><Check size={18} /></span>}
                <div className="icon"><Icon size={18} /></div>
                <h3>{level.label}</h3>
                <p>{level.description}</p>
              </div>
            );
          })}
        </div>

        <div
          className={`sabi-fam-perm-emergency ${levelId === EMERGENCY_ONLY_LEVEL.id ? "selected" : ""}`}
          onClick={() => onSelectLevel(EMERGENCY_ONLY_LEVEL.id)}
        >
          <div className="icon"><EMERGENCY_ONLY_LEVEL.icon size={18} /></div>
          <div>
            <h3>{EMERGENCY_ONLY_LEVEL.label}</h3>
            <p>{EMERGENCY_ONLY_LEVEL.description}</p>
          </div>
        </div>
      </div>

      <div className="sabi-fam-access-panel">
        <h3>Granular Access</h3>
        {ACCESS_KEYS.map(({ key, label }) => {
          const Icon = ACCESS_ICONS[key];
          return (
            <div className="sabi-fam-access-row" key={key}>
              <span className="label"><Icon size={16} /> {label}</span>
              <button
                type="button"
                className={`sabi-fam-switch ${access[key] ? "on" : ""}`}
                onClick={() => onToggleAccess(key)}
                aria-label={`Toggle ${label}`}
              >
                <span className="knob" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PermissionAccessPicker;

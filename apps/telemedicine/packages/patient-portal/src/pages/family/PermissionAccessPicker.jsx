import React from "react";
import { Check, User, FileText, Calendar, Pill, Activity, ShieldAlert } from "lucide-react";
import { PERMISSION_LEVELS, EMERGENCY_ONLY_LEVEL, ACCESS_KEYS } from "./data";

const ACCESS_ICONS = {
  PROFILE: User,
  RECORDS: FileText,
  APPOINTMENTS: Calendar,
  MEDICATIONS: Pill,
  VITALS: Activity,
  EMERGENCY_SUMMARY: ShieldAlert,
};

// Reused by AddMemberPage (access to grant or request) and MemberProfilePage (editing a
// member's access). `access` is an array of the server's permission keys.
export function PermissionAccessPicker({ levelId, access, onSelectLevel, onToggleAccess, compact = false, showLevels = true, disabled = false }) {
  const emergencyOnly = levelId === EMERGENCY_ONLY_LEVEL.id;
  return (
    <div className={compact || !showLevels ? "" : "sabi-fam-join-layout"}>
      {showLevels && (
        <div>
          <div className="sabi-fam-perm-grid">
            {PERMISSION_LEVELS.map((level) => {
              const Icon = level.icon;
              const selected = levelId === level.id;
              return (
                <button
                  type="button"
                  key={level.id}
                  className={`sabi-fam-perm-card ${selected ? "selected" : ""}`}
                  onClick={() => onSelectLevel(level.id)}
                  aria-pressed={selected}
                  disabled={disabled}
                >
                  {selected && <span className="check"><Check size={18} /></span>}
                  <div className="icon"><Icon size={18} /></div>
                  <h3>{level.label}</h3>
                  <p>{level.description}</p>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className={`sabi-fam-perm-emergency ${emergencyOnly ? "selected" : ""}`}
            onClick={() => onSelectLevel(EMERGENCY_ONLY_LEVEL.id)}
            aria-pressed={emergencyOnly}
            disabled={disabled}
          >
            <div className="icon"><EMERGENCY_ONLY_LEVEL.icon size={18} /></div>
            <div>
              <h3>{EMERGENCY_ONLY_LEVEL.label}</h3>
              <p>{EMERGENCY_ONLY_LEVEL.description}</p>
            </div>
          </button>
        </div>
      )}

      <div className="sabi-fam-access-panel">
        <h3>Granular Access</h3>
        {emergencyOnly && <p className="sabi-fam-access-hint">Emergency Only shares nothing, so these stay off.</p>}
        {ACCESS_KEYS.map(({ key, label }) => {
          const Icon = ACCESS_ICONS[key];
          const on = !emergencyOnly && access.includes(key);
          return (
            <div className="sabi-fam-access-row" key={key}>
              <span className="label"><Icon size={16} /> {label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                className={`sabi-fam-switch ${on ? "on" : ""}`}
                onClick={() => onToggleAccess(key)}
                aria-label={label}
                disabled={disabled || emergencyOnly}
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

export const toggleIn = (list, key) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

export default PermissionAccessPicker;

import React from "react";
import { FileText, AlertTriangle, ShieldAlert } from "lucide-react";

export function UsageSafetyCard({
  dosageInstructions,
  sideEffects,
  sideEffectsNote,
  criticalInteraction,
}) {
  return (
    <div className="sabi-card sabi-rxd-usage-card">
      <h2 className="sabi-rxd-card-title">Usage &amp; Safety Guidelines</h2>

      <div className="sabi-rxd-usage-grid">
        <div className="sabi-rxd-usage-col">
          <div className="sabi-rxd-usage-label">
            <FileText size={16} strokeWidth={2} />
            DOSAGE INSTRUCTIONS
          </div>
          <ul className="sabi-rxd-usage-list">
            {dosageInstructions.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        <div className="sabi-rxd-usage-col">
          <div className="sabi-rxd-usage-label">
            <AlertTriangle size={16} strokeWidth={2} />
            COMMON SIDE EFFECTS
          </div>
          <div className="sabi-rxd-side-effects">
            {sideEffects.map((effect) => (
              <span className="sabi-rxd-side-effect-pill" key={effect}>
                {effect}
              </span>
            ))}
          </div>
          <p className="sabi-rxd-side-effects-note">{sideEffectsNote}</p>
        </div>

        <div className="sabi-rxd-usage-col">
          <div className="sabi-rxd-usage-label danger">
            <ShieldAlert size={16} strokeWidth={2} />
            CRITICAL INTERACTIONS
          </div>
          <div className="sabi-rxd-critical-box">
            <div className="sabi-rxd-critical-title">{criticalInteraction.title}</div>
            <p className="sabi-rxd-critical-body">{criticalInteraction.body}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UsageSafetyCard;
import React from "react";
import { FlaskConical, Award, FileText, AlertTriangle, ShieldAlert, X, Pill } from "lucide-react";
import { getDrugInfo } from "../../drugInfo";

const WHY_ICONS = { FlaskConical, Award };

export function DrugDetailModal({ item, onClose }) {
  if (!item) return null;
  const info = getDrugInfo(item.name);

  return (
    <div className="sabi-modal-overlay" onClick={onClose}>
      <div
        className="sabi-modal sabi-modal-lg sabi-drug-modal"
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sabi-modal-head sabi-drug-modal-head">
          <div className="sabi-drug-modal-title">
            <span className="sabi-rxd-meds-icon">
              <Pill size={18} />
            </span>
            <div>
              <h3>{item.name}</h3>
              <p>
                {info.className} · {item.dosage}
              </p>
            </div>
          </div>
          <button type="button" className="sabi-modal-close" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="sabi-modal-body sabi-drug-modal-body">
          <div className="sabi-drug-modal-meta">
            <span>
              <strong>Quantity</strong>
              {item.qty}
            </span>
            <span>
              <strong>Purpose</strong>
              {info.purpose}
            </span>
          </div>

          <section className="sabi-rxd-why-list sabi-drug-modal-section">
            {info.whyThisMedication.map((why) => {
              const Icon = WHY_ICONS[why.icon];
              return (
                <div className="sabi-rxd-why-item" key={why.title}>
                  <div className="sabi-rxd-why-icon">{Icon && <Icon size={18} strokeWidth={2} />}</div>
                  <div>
                    <div className="sabi-rxd-why-item-title">{why.title}</div>
                    <p className="sabi-rxd-why-item-body">{why.body}</p>
                  </div>
                </div>
              );
            })}
          </section>

          <section className="sabi-drug-modal-section">
            <div className="sabi-rxd-usage-label">
              <FileText size={16} strokeWidth={2} />
              DOSAGE INSTRUCTIONS
            </div>
            <ul className="sabi-rxd-usage-list">
              {info.dosageInstructions.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          <section className="sabi-drug-modal-section">
            <div className="sabi-rxd-usage-label">
              <AlertTriangle size={16} strokeWidth={2} />
              COMMON SIDE EFFECTS
            </div>
            <div className="sabi-rxd-side-effects">
              {info.sideEffects.map((effect) => (
                <span className="sabi-rxd-side-effect-pill" key={effect}>
                  {effect}
                </span>
              ))}
            </div>
            <p className="sabi-rxd-side-effects-note">{info.sideEffectsNote}</p>
          </section>

          <section className="sabi-drug-modal-section">
            <div className="sabi-rxd-usage-label danger">
              <ShieldAlert size={16} strokeWidth={2} />
              CRITICAL INTERACTIONS
            </div>
            <div className="sabi-rxd-critical-box">
              <div className="sabi-rxd-critical-title">{info.criticalInteraction.title}</div>
              <p className="sabi-rxd-critical-body">{info.criticalInteraction.body}</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default DrugDetailModal;

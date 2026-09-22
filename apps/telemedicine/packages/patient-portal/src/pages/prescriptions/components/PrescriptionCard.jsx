import React from "react";
import { Pill, Syringe } from "lucide-react";

const ICONS = { Pill, Syringe };

/* DEBUG NOTE: Prescriptions refactor - Removed the renewal action, leaving a consistent details entry point. */
export function PrescriptionCard({ prescription, onViewDetails }) {
  const Icon = ICONS[prescription.icon] || Pill;
  const isDanger = prescription.status === "Needs Renewal";
  const itemCount = prescription.itemCount || 1;

  return (
    <div className="sabi-card sabi-rx-card">
      <div className="sabi-rx-card-top">
        <div className={`sabi-rx-card-icon ${isDanger ? "danger" : ""}`}>
          <Icon size={20} strokeWidth={2} />
        </div>
        <div className="sabi-rx-card-heading">
          <div className="sabi-rx-card-name">{prescription.name}</div>
          <div className="sabi-rx-card-purpose">
            {prescription.purpose}
            {itemCount > 1 && <span className="sabi-rx-card-count"> · {itemCount} medications</span>}
          </div>
        </div>
        <span className={`sabi-pill sabi-rx-status ${isDanger ? "danger" : ""}`}>
          {prescription.status}
        </span>
      </div>

      <div className="sabi-rx-card-grid">
        <div>
          <div className="sabi-rx-card-field-label">DOSAGE</div>
          <div className="sabi-rx-card-field-value">{prescription.dosage}</div>
        </div>
        <div>
          <div className="sabi-rx-card-field-label">FREQUENCY</div>
          <div className="sabi-rx-card-field-value">{prescription.frequency}</div>
        </div>
        <div>
          <div className="sabi-rx-card-field-label">PRESCRIBED</div>
          <div className="sabi-rx-card-field-value">{prescription.prescribed}</div>
        </div>
        <div>
          <div className="sabi-rx-card-field-label">{prescription.fifthLabel}</div>
          <div className={`sabi-rx-card-field-value ${prescription.fifthDanger ? "danger" : ""}`}>
            {prescription.fifthValue}
          </div>
        </div>
      </div>

      <div className="sabi-rx-card-footer">
        <div className="sabi-rx-doctor">
          <div className="sabi-rx-doctor-avatar">
            {prescription.doctor.avatar ? (
              <img src={prescription.doctor.avatar} alt={prescription.doctor.name} />
            ) : (
              prescription.doctor.name.split(" ").map((n) => n[0]).join("")
            )}
          </div>
          <span>{prescription.doctor.name}</span>
        </div>

        <div className="sabi-rx-card-actions">
          <button className="sabi-rx-view-link" onClick={() => onViewDetails(prescription)}>
            View Details <span aria-hidden="true">›</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default PrescriptionCard;

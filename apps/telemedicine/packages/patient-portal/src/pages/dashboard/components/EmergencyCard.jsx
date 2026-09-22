import React, { useState } from "react";
import { Card } from "design-system";
import { ImagePlus, ArrowRight } from "lucide-react";
import { EmergencyCardModal } from "./EmergencyCardModal";

export function EmergencyCard({ blood = "O+", genotype = "AA" }) {
  const [showModal, setShowModal] = useState(false);

  // Pattern matrix to mirror the active/inactive grid tiles in the design
  const gridPattern = [
    true,  true,  true,  false,
    true,  true,  true,  false,
    true,  true,  false, true,
    false, true,  false, true,
  ];

  return (
    <Card className="sabi-emergency-card">
      {/* Header */}
      <div className="sabi-emergency-head">
        <span className="sabi-emergency-label">EMERGENCY ID</span>
        <button
          className="sabi-emergency-photo-btn"
          aria-label="Add ID photo"
          type="button"
        >
          <ImagePlus size={16} />
        </button>
      </div>

      {/* Main Body Layout */}
      <div className="sabi-emergency-body">
        {/* Left: Decorative 4x4 Grid */}
        <div className="sabi-emergency-grid" aria-hidden="true">
          {gridPattern.map((isActive, i) => (
            <span key={i} className={isActive ? "active" : ""} />
          ))}
        </div>

        {/* Right: Info & Stats */}
        <div className="sabi-emergency-info">
          <div className="sabi-emergency-stats">
            <div className="sabi-stat-item">
              <span className="sabi-emergency-stat-label">BLOOD</span>
              <span className="sabi-emergency-stat-value">{blood}</span>
            </div>
            <div className="sabi-stat-item">
              <span className="sabi-emergency-stat-label">GENOTYPE</span>
              <span className="sabi-emergency-stat-value">{genotype}</span>
            </div>
          </div>

          <button
            className="sabi-emergency-link"
            type="button"
            onClick={() => setShowModal(true)}
          >
            View Critical Info <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {showModal && <EmergencyCardModal onClose={() => setShowModal(false)} />}
    </Card>
  );
}

export default EmergencyCard;
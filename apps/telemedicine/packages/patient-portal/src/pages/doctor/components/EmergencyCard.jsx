import React from "react";
import { Card } from "design-system";

export function EmergencyCard({ blood = "O+", genotype = "AA" }) {
  return (
    <Card style={{ background: "var(--sabi-primary-dark)", color: "#fff" }}>
      <div className="sabi-emergency-head">
        <span className="sabi-emergency-label">Emergency ID</span>
        <button className="sabi-emergency-photo-btn" aria-label="Add ID photo" type="button">
          🖼️
        </button>
      </div>

      <div className="sabi-emergency-body">
        {/* Decorative — purely visual, mirrors the ID-card grid pattern in the design */}
        <div className="sabi-emergency-grid" aria-hidden="true">
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} />
          ))}
        </div>

        <div className="sabi-emergency-stats">
          <div>
            <div className="sabi-emergency-stat-label">Blood</div>
            <div className="sabi-emergency-stat-value">{blood}</div>
          </div>
          <div>
            <div className="sabi-emergency-stat-label">Genotype</div>
            <div className="sabi-emergency-stat-value">{genotype}</div>
          </div>
        </div>
      </div>

      <button className="sabi-emergency-link" type="button">
        View Critical Info <span aria-hidden="true">→</span>
      </button>
    </Card>
  );
}

export default EmergencyCard;

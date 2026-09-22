import React from "react";
import { Card } from "design-system";

export function InsightCard() {
  return (
    <Card style={{ background: "var(--sabi-primary-light)" }}>
      <div className="sabi-insight">
        <span className="sabi-insight-icon">✨</span>
        <div>
          <div className="sabi-insight-title">Sabi AI Insights</div>
          <div className="sabi-insight-text">
            Based on your activity trends, increasing your water intake by 250ml could reduce evening fatigue.
          </div>
        </div>
      </div>
    </Card>
  );
}

export default InsightCard;

import React from "react";
import { Card } from "design-system";
import { Sparkles } from "lucide-react";

// No AI analysis of this patient's actual data runs here yet (BACKEND REQUIRED) —
// this is a general wellness tip, not a personalized insight, and is labeled that way
// rather than falsely claiming it was derived from "your activity trends."
export function InsightCard() {
  return (
    <Card style={{ background: "var(--sabi-primary-light)" }}>
      <div className="sabi-insight">
        <span className="sabi-insight-icon">
          <Sparkles />
        </span>
        <div>
          <div className="sabi-insight-title">Wellness Tip</div>
          <div className="sabi-insight-text">
            Increasing your water intake by 250ml can help reduce evening fatigue for many people.
          </div>
        </div>
      </div>
    </Card>
  );
}

export default InsightCard;

import React from "react";
import { Card } from "design-system";
import { TrendingUp } from "lucide-react";
import { SectionTitle, ScoreDonut } from "../share";

// A composite "health score" is a real clinical/wellness calculation this
// frontend has no way to compute — no score or trend is invented here.
// Both stay unset until a real backend supplies them.
export function HealthScoreCard({ score, trend }) {
  if (score == null) {
    return (
      <Card className="sabi-score-card">
        <SectionTitle center eyebrow>Overall Health Score</SectionTitle>
        <p style={{ textAlign: "center", color: "var(--sabi-text-secondary)", fontSize: "0.86rem", margin: "12px 0" }}>
          Not enough health data recorded yet to calculate a score.
        </p>
      </Card>
    );
  }

  return (
    <Card className="sabi-score-card">
      <div className="sabi-score-top">
        <SectionTitle center eyebrow>Overall Health Score</SectionTitle>
        <ScoreDonut score={score} />
      </div>
      {trend && (
        <div className="sabi-score-trend">
          <span className="sabi-score-trend-label">
            Weekly Trend
            <br />
            <span className="sabi-score-trend-value">{trend}</span>
          </span>
          <TrendingUp size={18} color="var(--sabi-success)" aria-hidden="true" />
        </div>
      )}
    </Card>
  );
}

export default HealthScoreCard;

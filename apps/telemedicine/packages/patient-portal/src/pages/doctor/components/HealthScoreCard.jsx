import React from "react";
import { Card } from "design-system";
import { SectionTitle, ScoreDonut } from "../share";

export function HealthScoreCard({ score = 91, trend = "+2.4% Improving" }) {
  return (
    <Card className="sabi-score-card">
      <div className="sabi-score-top">
        <SectionTitle center eyebrow>Overall Health Score</SectionTitle>
        <ScoreDonut score={score} />
      </div>
      <div className="sabi-score-trend">
        <span className="sabi-score-trend-label">
          Weekly Trend
          <br />
          <span className="sabi-score-trend-value">{trend}</span>
        </span>
        <span aria-hidden="true">📶</span>
      </div>
    </Card>
  );
}

export default HealthScoreCard;

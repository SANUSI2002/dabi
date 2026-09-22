import React from "react";

// --sabi-score is data-driven, so it's set inline here; Dashboard.css
// turns it into the conic-gradient percentage.
export function ScoreDonut({ score }) {
  return (
    <div className="sabi-donut" style={{ "--sabi-score": score }}>
      <div className="sabi-donut-value">
        {score}
        <span>out of 100</span>
      </div>
    </div>
  );
}

export default ScoreDonut;

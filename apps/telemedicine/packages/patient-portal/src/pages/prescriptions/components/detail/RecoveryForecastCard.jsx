import React from "react";

export function RecoveryForecastCard({ forecast }) {
  return (
    <div className="sabi-rxd-forecast-card">
      <div className="sabi-rxd-forecast-body">
        <h2 className="sabi-rxd-forecast-title">Personalized Recovery Forecast</h2>
        <p className="sabi-rxd-forecast-message">{forecast.message}</p>

        <div className="sabi-rxd-forecast-stats">
          <div className="sabi-rxd-forecast-stat">
            <div className="sabi-rxd-forecast-stat-label">ADHERENCE</div>
            <div className="sabi-rxd-forecast-stat-value">{forecast.adherence}</div>
          </div>
          <div className="sabi-rxd-forecast-stat">
            <div className="sabi-rxd-forecast-stat-label">NEXT SYNC</div>
            <div className="sabi-rxd-forecast-stat-value">{forecast.nextSync}</div>
          </div>
        </div>
      </div>

      <div className="sabi-rxd-forecast-art" aria-hidden="true" />
    </div>
  );
}

export default RecoveryForecastCard;
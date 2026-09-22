import React from "react";
import { ShieldCheck, TrendingDown } from "lucide-react";

export function DiagnosisOverviewCard({ diagnosis }) {
  return (
    <div className="sabi-card sabi-rxd-diagnosis-card">
      <div className="sabi-rxd-diagnosis-head">
        <h2 className="sabi-rxd-card-title">Diagnosis Overview</h2>
        <div className="sabi-rxd-shield-icon">
          <ShieldCheck size={18} strokeWidth={2} />
        </div>
      </div>

      <div className="sabi-rxd-diagnosis-box">
        <div className="sabi-rxd-diagnosis-label">{diagnosis.label}</div>
        <div className="sabi-rxd-diagnosis-title">{diagnosis.title}</div>
      </div>

      <p className="sabi-rxd-diagnosis-desc">{diagnosis.description}</p>

      <div className="sabi-rxd-target-pill">
        <TrendingDown size={16} strokeWidth={2} />
        {diagnosis.target.label}: {diagnosis.target.value}
      </div>
    </div>
  );
}

export default DiagnosisOverviewCard;
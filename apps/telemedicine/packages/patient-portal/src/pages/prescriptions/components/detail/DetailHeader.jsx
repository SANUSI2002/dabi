import React from "react";
import { ArrowLeft, Share2, Printer } from "lucide-react";

export function DetailHeader({ detail, onBack, onShare, onPrint }) {
  return (
    <div className="sabi-rxd-header">
      <button className="sabi-rxd-back" onClick={onBack}>
        <ArrowLeft size={18} strokeWidth={2} />
        Back to Prescriptions
      </button>

      <div className="sabi-rxd-meta">
        <span className="sabi-rxd-status-badge">{detail.status}</span>
        <span className="sabi-rxd-ref">Ref ID: {detail.refId}</span>
      </div>

      <div className="sabi-rxd-title-row">
        <div>
          <h1 className="sabi-rxd-title">{detail.name}</h1>
          <div className="sabi-rxd-physician">
            <span className="sabi-rxd-physician-icon" aria-hidden="true">🩺</span>
            Prescribing Physician: <strong>{detail.physician}</strong>
          </div>
        </div>

        <div className="sabi-rxd-title-actions">
          <button className="sabi-rxd-icon-btn" onClick={onShare} aria-label="Share">
            <Share2 size={18} strokeWidth={2} />
          </button>
          <button className="sabi-rxd-icon-btn" onClick={onPrint} aria-label="Print">
            <Printer size={18} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default DetailHeader;
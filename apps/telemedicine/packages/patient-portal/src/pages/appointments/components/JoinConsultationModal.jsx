import React from "react";
import { X, Video } from "lucide-react";

export function JoinConsultationModal({ appointment, onClose }) {
  return (
    <div className="sabi-modal-overlay" onClick={onClose}>
      <div className="sabi-modal" role="dialog" aria-modal="true" aria-label="Join consultation" onClick={(e) => e.stopPropagation()}>
        <div className="sabi-modal-head">
          <h3>Starting Consultation</h3>
          <button type="button" className="sabi-modal-close" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="sabi-emcard-box" style={{ textAlign: "center", padding: "28px 16px" }}>
          <Video size={28} style={{ marginBottom: 10, color: "var(--sabi-primary)" }} />
          <p style={{ margin: 0, fontWeight: 600 }}>
            {appointment.meetingUrl ? `Your video consultation with ${appointment.doctor}` : `${appointment.doctor} hasn't added the video link yet`}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: "0.85rem", color: "var(--sabi-text-secondary)" }}>
            Please make sure your camera and microphone are enabled before joining.
          </p>
          {appointment.meetingUrl && (
            <a className="sabi-apt-join-btn" style={{ marginTop: 14, display: "inline-flex", textDecoration: "none" }} href={appointment.meetingUrl} target="_blank" rel="noopener noreferrer">
              <Video size={15} /> Join Now
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default JoinConsultationModal;

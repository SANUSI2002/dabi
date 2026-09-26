import React, { useEffect } from "react";
import { X, CheckCircle2, MapPin, CalendarDays, Video, User2, Stethoscope, Wallet } from "lucide-react";
import { CONSULTATION_LABELS, formatNaira, mapsSearchUrl } from "../../../api/doctorsApi";

const when = (iso) => new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** A verified doctor's public profile — only what the doctor has published. */
export function DoctorProfileModal({ doctor, onClose, onBook }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="sabi-modal-overlay" onClick={onClose}>
      <div className="sabi-modal sabi-modal-lg sabi-profile-modal" role="dialog" aria-modal="true" aria-label={doctor.name} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="sabi-modal-close sabi-profile-close" aria-label="Close" onClick={onClose}>
          <X size={16} />
        </button>

        <div className="sabi-profile-hero sabi-doctor-profile-hero">
          <span className="sabi-doctor-avatar sabi-doctor-avatar-lg" aria-hidden="true">{doctor.initials}</span>
          <div className="sabi-profile-hero-copy">
            <span className="sabi-doctor-verified"><CheckCircle2 size={13} /> Verified by Sabi Health</span>
            <h3>{doctor.name}</h3>
            <p>{doctor.specialty}{doctor.practiceName ? ` · ${doctor.practiceName}` : ""}</p>
          </div>
        </div>

        <div className="sabi-profile-body">
          <div className="sabi-profile-main">
            <h4>About</h4>
            <p>{doctor.bio || `${doctor.name} hasn't added a profile summary yet.`}</p>

            <div className="sabi-profile-detail-row"><Stethoscope size={16} /> {doctor.yearsOfExperience != null ? `${doctor.yearsOfExperience}+ years of experience` : "Experience not listed"}</div>
            <div className="sabi-profile-detail-row"><Wallet size={16} /> {doctor.fee != null ? `${formatNaira(doctor.fee)} per consultation` : "Fee not listed — ask the practice"}</div>
            <div className="sabi-profile-detail-row">
              {doctor.consultationTypes.includes("VIRTUAL") ? <Video size={16} /> : <User2 size={16} />}{" "}
              {doctor.consultationTypes.length ? doctor.consultationTypes.map((t) => CONSULTATION_LABELS[t]).join(" · ") : "Consultation types shown per time slot"}
            </div>
            {doctor.practiceAddress && (
              <div className="sabi-profile-detail-row">
                <MapPin size={16} />{" "}
                <a href={mapsSearchUrl(doctor.practiceAddress)} target="_blank" rel="noopener noreferrer">{doctor.practiceAddress}</a>
              </div>
            )}
            <div className="sabi-profile-detail-row">
              <CalendarDays size={16} /> {doctor.nextAvailableAt ? `Next available: ${when(doctor.nextAvailableAt)}` : "No open times published yet"}
            </div>
          </div>
        </div>

        <div className="sabi-modal-actions sabi-profile-actions">
          <button type="button" className="sabi-doctor-outline" onClick={onClose}>Close</button>
          <button type="button" className="sabi-doctor-primary sabi-profile-book" onClick={() => onBook(doctor)} disabled={!doctor.nextAvailableAt}>
            {doctor.nextAvailableAt ? "Book Appointment" : "No Open Times Yet"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DoctorProfileModal;

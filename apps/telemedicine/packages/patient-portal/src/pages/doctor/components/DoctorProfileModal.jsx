import React, { useEffect } from "react";
import { Award, Building2, CheckCircle2, GraduationCap, MessageSquare, ShieldCheck, Star, Users, X } from "lucide-react";

export function DoctorProfileModal({ doctor, onClose, onBook }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!doctor) return null;

  return (
    <div className="sabi-modal-overlay" onClick={onClose}>
      <div
        className="sabi-modal sabi-modal-lg sabi-profile-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${doctor.name} profile`}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="sabi-modal-close sabi-profile-close" aria-label="Close" onClick={onClose}>
          <X size={16} />
        </button>

        <div className="sabi-profile-hero">
          {doctor.photo ? <img src={doctor.photo} alt={doctor.name} /> : <div className="sabi-doctor-photo-initials sabi-profile-initials" aria-hidden="true">{doctor.initials}</div>}
          <div className="sabi-profile-hero-copy">
            <span className="sabi-profile-verified"><CheckCircle2 size={13} /> Verified Specialist</span>
            <h2>{doctor.name}</h2>
            <p>{doctor.title || doctor.specialty}</p>

            <div className="sabi-profile-stats">
              <div>
                <strong>{doctor.experience != null ? `${doctor.experience}+` : "—"}</strong>
                <small>Years</small>
              </div>
              <div>
                <strong>{doctor.patients || "—"}</strong>
                <small>Patients</small>
              </div>
              <div>
                <strong><Star size={13} fill="currentColor" /> {doctor.rating}</strong>
                <small>Rating</small>
              </div>
            </div>
          </div>
        </div>

        <div className="sabi-profile-body">
          <div className="sabi-profile-main">
            <section>
              <h4>About & Philosophy</h4>
              <p>{doctor.about}</p>
              <div className="sabi-profile-detail-row">
                <GraduationCap size={16} />
                <div>
                  <strong>Education</strong>
                  <span>{doctor.education}</span>
                </div>
              </div>
              <div className="sabi-profile-detail-row">
                <ShieldCheck size={16} />
                <div>
                  <strong>Certifications</strong>
                  <span>{doctor.certifications}</span>
                </div>
              </div>
            </section>

            <section>
              <h4>Expertise</h4>
              <div className="sabi-profile-pills">
                {(doctor.expertise || []).map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </section>

            <section>
              <h4>Affiliations</h4>
              <div className="sabi-profile-affiliations">
                {(doctor.affiliations || []).map((item) => (
                  <div key={item.name}>
                    <Building2 size={16} />
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.role}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="sabi-profile-side">
            <div className="sabi-profile-side-card">
              <span className="sabi-profile-side-label">Consultation Fee</span>
              <strong className="sabi-profile-side-fee">{doctor.fee != null ? `₦${doctor.fee.toLocaleString()}` : "—"}</strong>
              <span className="sabi-profile-side-next">Next available: {doctor.nextAvailable}</span>

              <button type="button" className="sabi-doctor-primary sabi-profile-book" onClick={() => onBook(doctor)} disabled={!doctor.nextAvailableAt}>
                Book Appointment
              </button>
              <button type="button" className="sabi-doctor-outline sabi-profile-message">
                <MessageSquare size={16} /> Message
              </button>
            </div>

            <div className="sabi-profile-trust">
              <Users size={18} />
              <div>
                <strong>Trusted by Sabi Health</strong>
                <span>Meets our 15-point clinical excellence standard.</span>
              </div>
            </div>

            {doctor.awards && (
              <div className="sabi-profile-trust">
                <Award size={18} />
                <div>
                  <strong>{doctor.awards} Awards</strong>
                  <span>Recognized for outstanding patient outcomes.</span>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

export default DoctorProfileModal;

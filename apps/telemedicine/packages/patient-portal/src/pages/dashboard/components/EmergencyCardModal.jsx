import React, { useState, useEffect } from "react";
import { X, RotateCw, Phone } from "lucide-react";
import { toEmergencyProfile } from "../data";
import { useApiData } from "../../../api/useApiData";
import { getProfile } from "../../../api/profileApi";

export function EmergencyCardModal({ onClose }) {
  const [flipped, setFlipped] = useState(false);
  const { data: profile } = useApiData(getProfile, []);
  const P = toEmergencyProfile(profile);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="sabi-modal-overlay" onClick={onClose}>
      <div className="sabi-modal sabi-emcard-modal" role="dialog" aria-modal="true" aria-label="Emergency card" onClick={(e) => e.stopPropagation()}>
        <div className="sabi-modal-head">
          <h3>Emergency Card</h3>
          <button type="button" className="sabi-modal-close" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <p className="sabi-emcard-note">
          Anyone who scans your Emergency QR code sees this — keep it accurate. In an emergency, showing this screen
          to a first responder works just as well as the QR code.
        </p>

        {!flipped ? (
          <div className="sabi-emcard-face">
            <div className="sabi-emcard-top">
              <div className="sabi-emcard-avatar">{P.initials}</div>
              <div>
                <div className="sabi-emcard-name">{P.name}</div>
                <div className="sabi-emcard-sub">{P.dob} · Age {P.age}</div>
              </div>
              <div className="sabi-emcard-qr" aria-hidden="true">
                {Array.from({ length: 16 }).map((_, i) => (
                  <span key={i} />
                ))}
              </div>
            </div>

            <div className="sabi-emcard-stats">
              <div>
                <div className="sabi-emcard-stat-label">Blood Group</div>
                <div className="sabi-emcard-stat-value">{P.bloodGroup}</div>
              </div>
              <div>
                <div className="sabi-emcard-stat-label">Genotype</div>
                <div className="sabi-emcard-stat-value">{P.genotype}</div>
              </div>
            </div>

            <div className="sabi-emcard-box">
              <div className="sabi-emcard-box-label">Emergency Contact</div>
              <div className="sabi-emcard-contact">
                <Phone size={14} /> {P.emergencyContact.name} · {P.emergencyContact.phone}
              </div>
            </div>
          </div>
        ) : (
          <div className="sabi-emcard-face">
            <div className="sabi-emcard-box">
              <div className="sabi-emcard-box-label">Medical Conditions</div>
              <div className="sabi-emcard-pills">
                {!P.conditions.length && <span className="sabi-emcard-pill">None recorded</span>}
                {P.conditions.map((c) => (
                  <span key={c} className="sabi-emcard-pill">{c}</span>
                ))}
              </div>
            </div>

            <div className="sabi-emcard-box">
              <div className="sabi-emcard-box-label">Allergies</div>
              <div className="sabi-emcard-pills">
                {!P.allergies.drugs.length && <span className="sabi-emcard-pill">None recorded</span>}
                {[...P.allergies.drugs, ...P.allergies.foods, ...P.allergies.others].map((a) => (
                  <span key={a} className="sabi-emcard-pill sabi-emcard-pill-danger">{a}</span>
                ))}
              </div>
            </div>

            <div className="sabi-emcard-box">
              <div className="sabi-emcard-box-label">Current Medications</div>
              <ul className="sabi-emcard-list">
                {!P.medications.length && <li>None recorded</li>}
                {P.medications.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>

            <div className="sabi-emcard-box">
              <div className="sabi-emcard-box-label">Emergency Contacts</div>
              <div className="sabi-emcard-contact">Primary: {P.contacts.primary.name} · {P.contacts.primary.phone}</div>
              <div className="sabi-emcard-contact">Secondary: {P.contacts.secondary.name} · {P.contacts.secondary.phone}</div>
            </div>

            <div className="sabi-emcard-box">
              <div className="sabi-emcard-box-label">Primary Healthcare Provider</div>
              <div className="sabi-emcard-contact">{P.provider.name} · {P.provider.phone}</div>
            </div>

            <div className="sabi-emcard-box">
              <div className="sabi-emcard-box-label">Insurance</div>
              <div className="sabi-emcard-contact">{P.insurance.provider} · Policy {P.insurance.policyNumber}</div>
            </div>
          </div>
        )}

        <button type="button" className="sabi-emcard-flip" onClick={() => setFlipped((f) => !f)}>
          <RotateCw size={15} /> {flipped ? "Show front" : "Show medical details"}
        </button>
      </div>
    </div>
  );
}

export default EmergencyCardModal;

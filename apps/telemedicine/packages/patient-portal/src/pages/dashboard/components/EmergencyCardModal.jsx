import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { X, RotateCw, Phone, Loader2 } from "lucide-react";
import { useApiData } from "../../../api/useApiData";
import { getProfile } from "../../../api/profileApi";
import { getCurrentUser } from "../../../utils/sabiIdentity";

const NOT_RECORDED = "Not recorded";
const splitList = (value) => (value ? value.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean) : []);

function ageFrom(dob) {
  if (!dob) return null;
  const birth = new Date(`${dob}T00:00:00Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  if (now.getUTCMonth() < birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

/** The patient's own emergency details, straight from their saved profile. */
export function EmergencyCardModal({ onClose }) {
  const [flipped, setFlipped] = useState(false);
  const { data, loading, error } = useApiData(getProfile, []);
  const p = data?.form;
  const account = data?.account;

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const name = p?.fullName || getCurrentUser()?.fullName || "Patient";
  const initials = name.split(/\s+/).filter(Boolean).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  const age = ageFrom(p?.dob);
  const conditions = splitList(p?.chronicConditions);
  const allergies = splitList(p?.knownAllergies);
  const medications = splitList(p?.currentMedications);
  const contact = p?.contactName ? `${p.contactName}${p.contactRelation ? ` (${p.contactRelation})` : ""} · ${p.contactPhone}` : null;

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
          Show this screen to a first responder in an emergency. It comes from your saved profile —{" "}
          <Link to="/profile" onClick={onClose}>keep it up to date</Link>.
        </p>

        {error ? (
          <p className="sabi-form-error" role="alert">{error.message}</p>
        ) : loading && !p ? (
          <div className="sabi-live-state" aria-busy="true">
            <Loader2 size={24} className="sabi-spin" />
            <p>Loading your emergency details…</p>
          </div>
        ) : !flipped ? (
          <div className="sabi-emcard-face">
            <div className="sabi-emcard-top">
              <div className="sabi-emcard-avatar">{initials}</div>
              <div>
                <div className="sabi-emcard-name">{name}</div>
                <div className="sabi-emcard-sub">
                  {[p.dob && new Date(`${p.dob}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }), age !== null && `Age ${age}`, account?.patientId]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
            </div>

            <div className="sabi-emcard-stats">
              <div>
                <div className="sabi-emcard-stat-label">Blood Group</div>
                <div className="sabi-emcard-stat-value">{p.bloodType || NOT_RECORDED}</div>
              </div>
              <div>
                <div className="sabi-emcard-stat-label">Genotype</div>
                <div className="sabi-emcard-stat-value">{p.genotype || NOT_RECORDED}</div>
              </div>
            </div>

            <div className="sabi-emcard-box">
              <div className="sabi-emcard-box-label">Emergency Contact</div>
              <div className="sabi-emcard-contact">
                {contact ? (
                  <>
                    <Phone size={14} /> {contact}
                  </>
                ) : (
                  "No emergency contact saved"
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="sabi-emcard-face">
            <div className="sabi-emcard-box">
              <div className="sabi-emcard-box-label">Medical Conditions</div>
              {conditions.length ? (
                <div className="sabi-emcard-pills">
                  {conditions.map((c) => (
                    <span key={c} className="sabi-emcard-pill">{c}</span>
                  ))}
                </div>
              ) : (
                <div className="sabi-emcard-contact">None recorded</div>
              )}
            </div>

            <div className="sabi-emcard-box">
              <div className="sabi-emcard-box-label">Allergies</div>
              {allergies.length ? (
                <div className="sabi-emcard-pills">
                  {allergies.map((a) => (
                    <span key={a} className="sabi-emcard-pill sabi-emcard-pill-danger">{a}</span>
                  ))}
                </div>
              ) : (
                <div className="sabi-emcard-contact">None recorded</div>
              )}
            </div>

            <div className="sabi-emcard-box">
              <div className="sabi-emcard-box-label">Current Medications</div>
              {medications.length ? (
                <ul className="sabi-emcard-list">
                  {medications.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              ) : (
                <div className="sabi-emcard-contact">None recorded</div>
              )}
            </div>
          </div>
        )}

        {p && (
          <button type="button" className="sabi-emcard-flip" onClick={() => setFlipped((f) => !f)}>
            <RotateCw size={15} /> {flipped ? "Show front" : "Show medical details"}
          </button>
        )}
      </div>
    </div>
  );
}

export default EmergencyCardModal;

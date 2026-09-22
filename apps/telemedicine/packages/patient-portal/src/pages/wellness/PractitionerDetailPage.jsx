import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Star, Languages, CalendarPlus, ShieldCheck } from "lucide-react";

import "../../styles/share.css";
import "./Wellness.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { getCategory, getPractitioner } from "./wellnessStore";
import { formatNaira } from "../../utils/currency";

export function PractitionerDetailPage() {
  const [zoom] = useZoom();
  const { categoryId, practitionerId } = useParams();
  const navigate = useNavigate();
  const category = getCategory(categoryId);
  const practitioner = getPractitioner(practitionerId);

  if (!category || !practitioner) {
    return (
      <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
        <Sidebar />
        <div className="sabi-main">
          <Topbar />
          <div className="sabi-card">
            <p>We couldn&apos;t find that practitioner.</p>
            <button className="sabi-btn-primary" onClick={() => navigate("/wellness-hub")}>Back to Wellness Hub</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main sabi-wellness-main">
        <Topbar />

        <button className="sabi-rxd-back" onClick={() => navigate(`/wellness-hub/${categoryId}`)}>
          <ArrowLeft size={18} /> Back to {category.label}
        </button>

        <div className="sabi-card sabi-wellness-profile-card">
          <div className="sabi-wellness-profile-head">
            <img className="sabi-wellness-avatar-photo" src={practitioner.photo} alt={practitioner.name} />
            <div>
              <h1>{practitioner.name}</h1>
              <p>{practitioner.specialty} · {practitioner.yearsExperience}+ years experience</p>
              <span className="sabi-wellness-rating"><Star size={14} fill="currentColor" /> {practitioner.rating} ({practitioner.reviews} reviews)</span>
            </div>
            <div className="sabi-wellness-profile-rate">
              <small>Rate</small>
              <strong>{formatNaira(practitioner.rate)}</strong>
              <span>/ {practitioner.rateUnit}</span>
            </div>
          </div>

          <p className="sabi-hospitals-wizard-note">{practitioner.bio}</p>

          <h4 style={{ margin: "16px 0 8px", fontSize: ".9rem" }}>Specialties</h4>
          <div className="sabi-hospital-tags" style={{ marginBottom: 16 }}>
            {practitioner.specialties.map((s) => <span key={s}>{s}</span>)}
          </div>

          <p className="sabi-wellness-languages"><Languages size={14} /> Speaks {practitioner.languages.join(", ")}</p>

          {practitioner.supportsPhysical ? (
            <p className="sabi-wellness-visit-note">Available for physical (in-person) or virtual sessions.</p>
          ) : (
            <p className="sabi-wellness-visit-note">Available for virtual sessions only.</p>
          )}

          <div className="sabi-hospitals-enroll-note" style={{ marginTop: 16 }}>
            <ShieldCheck size={15} /> Bookings are recurring engagements (30 or 60 days) — {practitioner.name.split(" ")[0]} will propose a schedule for you to review before anything is confirmed.
          </div>

          <button
            type="button"
            className="sabi-btn-primary sabi-btn-block"
            style={{ marginTop: 16 }}
            onClick={() => navigate(`/wellness-hub/${categoryId}/${practitionerId}/book`)}
          >
            <CalendarPlus size={16} /> Book {practitioner.name.split(" ")[0]}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PractitionerDetailPage;

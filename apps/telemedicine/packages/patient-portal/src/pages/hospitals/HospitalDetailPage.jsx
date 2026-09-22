import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Building2, CalendarClock, CheckCircle2, Clock3, MapPin, Phone,
  ShieldAlert, ShieldCheck, Star, UserPlus,
} from "lucide-react";

import "../../styles/share.css";
import "./Hospitals.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { HealthMap } from "../../map/Map";
import { getHospital } from "./hospitalStore";

export function HospitalDetailPage() {
  const [zoom] = useZoom();
  const { id } = useParams();
  const navigate = useNavigate();
  const hospital = getHospital(id);

  if (!hospital) {
    return (
      <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
        <Sidebar />
        <div className="sabi-main">
          <Topbar />
          <div className="sabi-card">
            <p>We couldn&apos;t find that hospital.</p>
            <button className="sabi-btn-primary" onClick={() => navigate("/hospitals")}>Back to Hospitals</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main sabi-hospitals-main">
        <Topbar />

        <button className="sabi-rxd-back" onClick={() => navigate("/hospitals")}>
          <ArrowLeft size={18} /> Back to Hospitals
        </button>

        <header className="sabi-hospitals-hero">
          <div>
            <h1>{hospital.name}</h1>
            <p>{hospital.area} · {hospital.yearsOperation} years of operation · {hospital.specialistCount}+ specialists</p>
            <div className="sabi-hospitals-hero-actions">
              <button type="button" className="sabi-btn-primary" onClick={() => navigate(`/hospitals/${hospital.id}/appointment`)}>
                <CalendarClock size={16} /> Book Appointment
              </button>
              <button type="button" className="sabi-hospitals-hero-outline" onClick={() => navigate(`/hospitals/${hospital.id}/enroll`)}>
                <UserPlus size={16} /> Enroll as Patient
              </button>
            </div>
          </div>
          <Building2 size={140} className="sabi-hospitals-hero-icon" />
        </header>

        <div className="sabi-hospitals-layout">
          <div className="sabi-hospitals-directory">
            <div className="sabi-card">
              <h3 style={{ margin: "0 0 12px" }}>About</h3>
              <p className="sabi-hospitals-wizard-note" style={{ marginBottom: 14 }}>{hospital.description}</p>

              <div className="sabi-hospital-badges" style={{ marginBottom: 14 }}>
                <span className="sabi-hospital-rating"><Star size={14} fill="currentColor" /> {hospital.rating} rating</span>
                {hospital.insuranceAccepted ? (
                  <span className="sabi-hospital-badge good"><CheckCircle2 size={15} /> Insurance Accepted</span>
                ) : (
                  <span className="sabi-hospital-badge muted">Self-pay only</span>
                )}
                {hospital.hasER && <span className="sabi-hospital-badge danger"><ShieldAlert size={15} /> 24/7 Emergency Room</span>}
              </div>

              <div className="sabi-hospitals-contact-grid">
                <div><MapPin size={15} /><span>{hospital.address}</span></div>
                <div><Phone size={15} /><span>{hospital.phone}</span></div>
                <div><Clock3 size={15} /><span>{hospital.hours}</span></div>
              </div>

              <h4 style={{ margin: "18px 0 8px", fontSize: ".9rem" }}>Departments</h4>
              <div className="sabi-hospital-tags" style={{ marginBottom: 18 }}>
                {hospital.departments.map((d) => <span key={d}>{d}</span>)}
              </div>

              <h4 style={{ margin: "0 0 8px", fontSize: ".9rem" }}>Amenities &amp; Facilities</h4>
              <div className="sabi-hospital-tags" style={{ marginBottom: 18 }}>
                {hospital.amenities.map((a) => <span key={a}>{a}</span>)}
              </div>

              <h4 style={{ margin: "0 0 8px", fontSize: ".9rem" }}>Insurance Partners</h4>
              {hospital.insurancePartners.length > 0 ? (
                <div className="sabi-hospital-tags" style={{ marginBottom: 18 }}>
                  {hospital.insurancePartners.map((p) => <span key={p}>{p}</span>)}
                </div>
              ) : (
                <p className="sabi-hospitals-wizard-note" style={{ marginBottom: 18 }}>This hospital doesn&apos;t currently accept insurance — self-pay or enrollment plan only.</p>
              )}

              <h4 style={{ margin: "0 0 8px", fontSize: ".9rem" }}>Enrollment Plans</h4>
              <div className="sabi-hospitals-plan-grid">
                {hospital.plans.map((plan) => (
                  <div className="sabi-hospitals-plan-card" key={plan.id}>
                    <strong>{plan.name}</strong>
                    <span>₦{plan.fee.toLocaleString()} enrollment fee</span>
                    {plan.description && <span>{plan.description}</span>}
                  </div>
                ))}
              </div>

              <div className="sabi-hospitals-enroll-note">
                <ShieldCheck size={15} /> You must enroll as a patient here before you can book an appointment.
              </div>
            </div>
          </div>

          <aside className="sabi-hospitals-sidebar">
            <HealthMap center={[hospital.lat, hospital.lng]} zoom={14} markers={[{ id: hospital.id, lat: hospital.lat, lng: hospital.lng, title: hospital.name }]} className="sabi-hospitals-map" />
          </aside>
        </div>
      </div>
    </div>
  );
}

export default HospitalDetailPage;

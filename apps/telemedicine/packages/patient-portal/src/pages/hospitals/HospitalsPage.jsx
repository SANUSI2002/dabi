import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Search, MapPin, Star, CheckCircle2, ShieldAlert, Building2, Users,
  CalendarClock, Stethoscope as StethoscopeIcon, ChevronRight,
} from "lucide-react";

import "../../styles/share.css";
import "./Hospitals.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { HealthMap } from "../../map/Map";
import { HOSPITALS } from "./hospitalStore";
import { getEnrollments } from "./hospitalStore";
import { getMembers } from "../family/familyStore";
import { getAppointments } from "../appointments/appointmentStore";

const TYPE_FILTERS = ["All Types", "Private Tertiary", "Multi-Specialty"];

function HospitalCard({ hospital, onSelect }) {
  return (
    <article className="sabi-hospital-card sabi-card">
      <div className="sabi-hospital-card-head">
        <div className="sabi-hospital-card-icon">
          <Building2 size={26} />
        </div>
        <div className="sabi-hospital-rating">
          <Star size={14} fill="currentColor" /> {hospital.rating}
        </div>
      </div>

      <div className="sabi-hospital-card-body">
        <h3>{hospital.name}</h3>
        <p className="sabi-hospital-card-sub">
          {hospital.area} · {hospital.yearsOperation} Years of Operation
        </p>

        <div className="sabi-hospital-tags">
          <span>{hospital.type}</span>
          <span>{hospital.specialistCount}+ Specialists</span>
        </div>

        <div className="sabi-hospital-badges">
          {hospital.insuranceAccepted ? (
            <span className="sabi-hospital-badge good">
              <CheckCircle2 size={15} /> Insurance Accepted
            </span>
          ) : (
            <span className="sabi-hospital-badge muted">Self-pay only</span>
          )}
          {hospital.hasER && (
            <span className="sabi-hospital-badge danger">
              <ShieldAlert size={15} /> 24/7 ER
            </span>
          )}
        </div>

        <div className="sabi-hospital-card-actions">
          <button type="button" className="sabi-btn-primary" onClick={() => onSelect(hospital, "appointment")}>
            Book Appointment
          </button>
          <button type="button" className="sabi-hospital-enroll-btn" onClick={() => onSelect(hospital, "enroll")}>
            Enroll as Patient
          </button>
          <button type="button" className="sabi-hospital-details-btn" onClick={() => onSelect(hospital, "details")}>
            View Hospital Details <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}

export function HospitalsPage() {
  const [zoom] = useZoom();
  const navigate = useNavigate();
  const { state } = useLocation();
  const enrollMemberId = state?.enrollMemberId;
  const enrollMemberName = state?.enrollMemberName;

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState(TYPE_FILTERS[0]);
  const [insuranceOnly, setInsuranceOnly] = useState(false);

  const hospitals = useMemo(
    () =>
      HOSPITALS.filter((h) => {
        const matchesQuery =
          !query ||
          `${h.name} ${h.area} ${h.type} ${h.departments.join(" ")}`.toLowerCase().includes(query.toLowerCase());
        const matchesType = typeFilter === "All Types" || h.type === typeFilter;
        const matchesInsurance = !insuranceOnly || h.insuranceAccepted;
        return matchesQuery && matchesType && matchesInsurance;
      }),
    [query, typeFilter, insuranceOnly]
  );

  const enrollments = getEnrollments();
  const members = getMembers();
  const selfMember = members.find((m) => m.isSelf) || members[0];
  const myEnrollments = enrollments.filter((e) => e.memberId === selfMember?.id);
  const activeMemberships = myEnrollments.filter((e) => e.status === "Enrolled");
  const hospitalAppointments = getAppointments().filter((a) => a.hospitalId);

  const handleSelect = (hospital, action) => {
    if (action === "appointment") navigate(`/hospitals/${hospital.id}/appointment`);
    else if (action === "enroll") {
      const query = enrollMemberId ? `?memberId=${enrollMemberId}` : "";
      navigate(`/hospitals/${hospital.id}/enroll${query}`);
    } else navigate(`/hospitals/${hospital.id}`);
  };

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main sabi-hospitals-main">
        <Topbar placeholder="Search hospitals, procedures..." />

        {enrollMemberId && (
          <div className="sabi-hospitals-enroll-banner">
            Choosing a hospital to enroll <strong>{enrollMemberName}</strong>. Pick "Enroll as Patient" on any hospital below.
          </div>
        )}

        <header className="sabi-hospitals-hero">
          <div>
            <h1>Hospitals</h1>
            <p>Enroll digitally, manage your hospital care, and access healthcare services from anywhere in Nigeria.</p>
            <div className="sabi-hospitals-hero-actions">
              <button
                type="button"
                className="sabi-btn-primary"
                onClick={() => document.getElementById("hospital-results")?.scrollIntoView({ behavior: "smooth" })}
              >
                <Search size={16} /> Find a Hospital
              </button>
              <button
                type="button"
                className="sabi-hospitals-hero-outline"
                onClick={() => {
                  setQuery("");
                  setTypeFilter("All Types");
                  setInsuranceOnly(false);
                  document.getElementById("hospital-results")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <ShieldAlert size={16} /> Emergency Hospitals
              </button>
            </div>
          </div>
          <Building2 size={140} className="sabi-hospitals-hero-icon" />
        </header>

        <section className="sabi-hospitals-stats">
          <div className="sabi-card sabi-hospitals-stat">
            <span className="icon"><Building2 size={18} /></span>
            <p className="label">Hospitals Enrolled</p>
            <p className="value">{String(myEnrollments.length).padStart(2, "0")}</p>
          </div>
          <div className="sabi-card sabi-hospitals-stat">
            <span className="icon"><CheckCircle2 size={18} /></span>
            <p className="label">Active Memberships</p>
            <p className="value">{String(activeMemberships.length).padStart(2, "0")}</p>
          </div>
          <div className="sabi-card sabi-hospitals-stat">
            <span className="icon"><CalendarClock size={18} /></span>
            <p className="label">Hospital Appointments</p>
            <p className="value">{String(hospitalAppointments.length).padStart(2, "0")}</p>
          </div>
          <div className="sabi-card sabi-hospitals-stat">
            <span className="icon"><Users size={18} /></span>
            <p className="label">Family Members</p>
            <p className="value">{String(members.length).padStart(2, "0")}</p>
          </div>
        </section>

        <section className="sabi-card sabi-hospitals-search">
          <div className="sabi-hospitals-search-input">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search by name, specialty, or location..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="sabi-hospitals-filters">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              {TYPE_FILTERS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button
              type="button"
              className={`sabi-hospitals-insurance-toggle ${insuranceOnly ? "active" : ""}`}
              onClick={() => setInsuranceOnly((v) => !v)}
            >
              <CheckCircle2 size={15} /> Insurance Accepted
            </button>
          </div>
        </section>

        <div className="sabi-hospitals-layout" id="hospital-results">
          <div className="sabi-hospitals-directory">
            <div className="sabi-hospitals-directory-head">
              <h2>Top Recommended Hospitals</h2>
              <p>{hospitals.length} result{hospitals.length === 1 ? "" : "s"}</p>
            </div>

            {hospitals.length === 0 ? (
              <div className="sabi-card sabi-empty-state">
                <StethoscopeIcon size={36} />
                <h3>No hospitals match those filters</h3>
                <p>Try clearing a filter or searching a different term.</p>
              </div>
            ) : (
              <div className="sabi-hospitals-grid">
                {hospitals.map((hospital) => (
                  <HospitalCard key={hospital.id} hospital={hospital} onSelect={handleSelect} />
                ))}
              </div>
            )}
          </div>

          <aside className="sabi-hospitals-sidebar">
            <div className="sabi-hospitals-sidebar-head">
              <h3>Nearby Hospitals</h3>
            </div>
            <HealthMap
              center={[hospitals[0]?.lat || 6.4478, hospitals[0]?.lng || 3.4726]}
              zoom={12}
              markers={hospitals.map((h) => ({ id: h.id, lat: h.lat, lng: h.lng, title: h.name }))}
              className="sabi-hospitals-map"
            />

            <div className="sabi-card sabi-hospitals-memberships">
              <div className="sabi-hospitals-memberships-head">
                <h4>Active Hospital Memberships</h4>
              </div>
              <button
                type="button"
                className="sabi-hospitals-add-member-btn"
                onClick={() => navigate("/family/hospital-enrollment")}
              >
                <Users size={16} /> Add Family Member
              </button>

              {activeMemberships.length === 0 ? (
                <p className="sabi-hospitals-memberships-empty">No active memberships yet.</p>
              ) : (
                <div className="sabi-hospitals-membership-list">
                  {activeMemberships.map((m) => (
                    <div className="sabi-hospitals-membership-row" key={m.id}>
                      <span className="icon"><MapPin size={16} /></span>
                      <div>
                        <p className="name">{m.hospitalName}</p>
                        <p className="plan">{m.planName}</p>
                      </div>
                      <CheckCircle2 size={16} className="verified" />
                    </div>
                  ))}
                </div>
              )}

              <button type="button" className="sabi-hospitals-manage-btn" onClick={() => navigate("/family/hospital-enrollment")}>
                Manage All Memberships
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default HospitalsPage;

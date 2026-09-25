import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, MapPin, CheckCircle2, Building2, Users, CalendarClock, Stethoscope as StethoscopeIcon, ChevronRight, Phone } from "lucide-react";

import "../../styles/share.css";
import "./Hospitals.css";

import { useApiData } from "../../api/useApiData";
import { listHospitals, listMyEnrollments, listMyHospitalAppointments } from "../../api/sabiApi";
import { LoadState, PageShell, useCareSubjects } from "./hospitalShared";

function HospitalCard({ hospital, enrollment, onSelect }) {
  return (
    <article className="sabi-hospital-card sabi-card">
      <div className="sabi-hospital-card-head">
        <div className="sabi-hospital-card-icon"><Building2 size={26} /></div>
        {enrollment && (
          <span className={`sabi-status-pill ${enrollment.status === "ACTIVE" ? "good" : enrollment.status === "PENDING" ? "pending" : "bad"}`}>
            {enrollment.statusLabel}
          </span>
        )}
      </div>

      <div className="sabi-hospital-card-body">
        <h3>{hospital.name}</h3>
        {hospital.area && <p className="sabi-hospital-card-sub"><MapPin size={13} /> {hospital.area}</p>}
        <div className="sabi-hospital-tags">
          <span>{hospital.typeLabel}</span>
          <span><CheckCircle2 size={12} /> Verified by Sabi</span>
        </div>
        {hospital.phone && <p className="sabi-hospital-card-sub"><Phone size={13} /> {hospital.phone}</p>}

        <div className="sabi-hospital-card-actions">
          <button type="button" className="sabi-btn-primary" onClick={() => onSelect(hospital, "appointment")}>Book Appointment</button>
          <button type="button" className="sabi-hospital-enroll-btn" onClick={() => onSelect(hospital, "enroll")}>Enroll as Patient</button>
          <button type="button" className="sabi-hospital-details-btn" onClick={() => onSelect(hospital, "details")}>
            View Hospital Details <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}

export function HospitalsPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const enrollDependentId = state?.enrollDependentId;
  const enrollMemberName = state?.enrollMemberName;

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setSearch(query.trim()), 350);
    return () => window.clearTimeout(t);
  }, [query]);

  const directory = useApiData(() => listHospitals({ search: search || undefined }), [search]);
  const enrollments = useApiData(() => listMyEnrollments(), []);
  const appointments = useApiData(() => listMyHospitalAppointments(), []);
  const { subjects } = useCareSubjects();

  const myEnrollments = enrollments.data || [];
  const selfEnrollmentFor = (hospitalId) => myEnrollments.find((e) => e.hospitalId === hospitalId && !e.dependentId);
  const activeMemberships = myEnrollments.filter((e) => e.status === "ACTIVE");
  const hospitals = directory.data?.items || [];

  const handleSelect = (hospital, action) => {
    if (action === "appointment") navigate(`/hospitals/${hospital.id}/appointment`);
    else if (action === "enroll") navigate(`/hospitals/${hospital.id}/enroll${enrollDependentId ? `?dependentId=${enrollDependentId}` : ""}`);
    else navigate(`/hospitals/${hospital.id}`);
  };

  const count = (value) => String(value).padStart(2, "0");

  return (
    <PageShell placeholder="Search hospitals...">
      {enrollDependentId && (
        <div className="sabi-hospitals-enroll-banner">
          Choosing a hospital to enroll <strong>{enrollMemberName}</strong>. Pick "Enroll as Patient" on any hospital below.
        </div>
      )}

      <header className="sabi-hospitals-hero">
        <div>
          <h1>Hospitals</h1>
          <p>Enroll digitally with verified hospitals, then book appointments and check in from anywhere.</p>
          <div className="sabi-hospitals-hero-actions">
            <button type="button" className="sabi-btn-primary" onClick={() => document.getElementById("hospital-results")?.scrollIntoView({ behavior: "smooth" })}>
              <Search size={16} /> Find a Hospital
            </button>
          </div>
        </div>
        <Building2 size={140} className="sabi-hospitals-hero-icon" />
      </header>

      <section className="sabi-hospitals-stats">
        <div className="sabi-card sabi-hospitals-stat">
          <span className="icon"><Building2 size={18} /></span>
          <p className="label">Enrollment Requests</p>
          <p className="value">{count(myEnrollments.length)}</p>
        </div>
        <div className="sabi-card sabi-hospitals-stat">
          <span className="icon"><CheckCircle2 size={18} /></span>
          <p className="label">Active Memberships</p>
          <p className="value">{count(activeMemberships.length)}</p>
        </div>
        <div className="sabi-card sabi-hospitals-stat">
          <span className="icon"><CalendarClock size={18} /></span>
          <p className="label">Hospital Appointments</p>
          <p className="value">{count(appointments.data?.length || 0)}</p>
        </div>
        <div className="sabi-card sabi-hospitals-stat">
          <span className="icon"><Users size={18} /></span>
          <p className="label">Dependents</p>
          <p className="value">{count(subjects.length - 1)}</p>
        </div>
      </section>

      <section className="sabi-card sabi-hospitals-search">
        <div className="sabi-hospitals-search-input">
          <Search size={18} />
          <input type="search" aria-label="Search hospitals" placeholder="Search by hospital name, city or address..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </section>

      <div className="sabi-hospitals-layout" id="hospital-results">
        <div className="sabi-hospitals-directory">
          <div className="sabi-hospitals-directory-head">
            <h2>Verified Hospitals</h2>
            {directory.data && <p>{directory.data.total} result{directory.data.total === 1 ? "" : "s"}</p>}
          </div>

          <LoadState loading={directory.loading && !directory.data} error={directory.error} onRetry={directory.reload} label="Loading hospitals…">
            {hospitals.length === 0 ? (
              <div className="sabi-card sabi-live-state">
                <StethoscopeIcon size={36} />
                <h3>{search ? "No hospitals match that search" : "No hospitals are available yet"}</h3>
                <p>{search ? "Try a different name, city or address." : "Hospitals appear here once Sabi has verified them. Check back soon."}</p>
              </div>
            ) : (
              <div className="sabi-hospitals-grid">
                {hospitals.map((hospital) => (
                  <HospitalCard key={hospital.id} hospital={hospital} enrollment={selfEnrollmentFor(hospital.id)} onSelect={handleSelect} />
                ))}
              </div>
            )}
          </LoadState>
        </div>

        <aside className="sabi-hospitals-sidebar">
          <div className="sabi-card sabi-hospitals-memberships">
            <div className="sabi-hospitals-memberships-head"><h4>Active Hospital Memberships</h4></div>
            <button type="button" className="sabi-hospitals-add-member-btn" onClick={() => navigate("/family/hospital-enrollment")}>
              <Users size={16} /> Family Enrollments
            </button>

            {enrollments.error ? (
              <p className="sabi-hospitals-memberships-empty" role="alert">Couldn&apos;t load your memberships.</p>
            ) : activeMemberships.length === 0 ? (
              <p className="sabi-hospitals-memberships-empty">No active memberships yet.</p>
            ) : (
              <div className="sabi-hospitals-membership-list">
                {activeMemberships.map((m) => (
                  <div className="sabi-hospitals-membership-row" key={m.id}>
                    <span className="icon"><MapPin size={16} /></span>
                    <div>
                      <p className="name">{m.hospitalName}</p>
                      <p className="plan">{m.planName}{m.memberName ? ` · ${m.memberName}` : ""}</p>
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
    </PageShell>
  );
}

export default HospitalsPage;

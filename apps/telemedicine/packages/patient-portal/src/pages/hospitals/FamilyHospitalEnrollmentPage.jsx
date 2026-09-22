import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Building2, Check, ChevronRight, Clock3, CreditCard, HeartHandshake,
  MapPin, MoreVertical, Shield, Star, UserPlus, XCircle,
} from "lucide-react";

import "../../styles/share.css";
import "./Hospitals.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { getMembers } from "../family/familyStore";
import { getEnrollments, HOSPITALS } from "./hospitalStore";

function statusFor(memberId, enrollments) {
  const memberEnrollments = enrollments.filter((e) => e.memberId === memberId);
  if (!memberEnrollments.length) return null;
  // Prefer an active/enrolled one if there is one, else the most recent.
  return memberEnrollments.find((e) => e.status === "Enrolled") || memberEnrollments[0];
}

export function FamilyHospitalEnrollmentPage() {
  const [zoom] = useZoom();
  const navigate = useNavigate();

  const members = getMembers();
  const enrollments = getEnrollments();
  const nearby = HOSPITALS.slice(0, 2);

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main sabi-hospitals-main">
        <Topbar placeholder="Search hospitals or members..." />

        <button className="sabi-rxd-back" onClick={() => navigate("/family")}>
          <ArrowLeft size={18} /> Back to Family &amp; Care Circle
        </button>

        <header className="sabi-hospitals-wizard-header">
          <div>
            <h1>Family Hospital Enrollment</h1>
            <p>
              Streamline healthcare for your loved ones. Manage facility registrations, digital ID cards, and
              medical access permissions for everyone in your circle.
            </p>
          </div>
        </header>

        <section className="sabi-family-hosp-value-row">
          <div className="sabi-card">
            <CreditCard size={20} />
            <strong>Digital IDs</strong>
            <span>Instant digital healthcare cards for all enrolled members.</span>
          </div>
          <div className="sabi-card">
            <Shield size={20} />
            <strong>Global History</strong>
            <span>Unified medical records across all Sabi-partnered facilities.</span>
          </div>
          <div className="sabi-card">
            <HeartHandshake size={20} />
            <strong>Secure Privacy</strong>
            <span>Granular control over who sees sensitive medical data.</span>
          </div>
        </section>

        <div className="sabi-family-hosp-head">
          <h2>Circle Members ({members.length})</h2>
        </div>

        <div className="sabi-family-hosp-grid">
          {members.map((member) => {
            const enrollment = statusFor(member.id, enrollments);
            return (
              <div className="sabi-card sabi-family-hosp-card" key={member.id}>
                <div className="sabi-family-hosp-card-head">
                  <div className="avatar" style={{ background: member.color }}>{member.initials}</div>
                  <div>
                    <strong>{member.name}</strong>
                    <span className="tag">{member.relationship || (member.isSelf ? "Self" : "Family Member")}{member.age ? ` · Age: ${member.age}` : ""}</span>
                  </div>
                  <button type="button" className="sabi-icon-btn" aria-label="More options"><MoreVertical size={16} /></button>
                </div>

                <div className="sabi-family-hosp-status-row">
                  <span>Enrollment Status</span>
                  {!enrollment && <span className="pill not-enrolled"><XCircle size={13} /> Not Enrolled</span>}
                  {enrollment?.status === "Awaiting Member Acceptance" && <span className="pill pending"><Clock3 size={13} /> Awaiting Their Acceptance</span>}
                  {enrollment?.status === "Pending Approval" && <span className="pill pending"><Clock3 size={13} /> Pending Approval</span>}
                  {enrollment?.status === "Enrolled" && <span className="pill enrolled"><Check size={13} /> Enrolled</span>}
                </div>

                {enrollment ? (
                  <div className="sabi-family-hosp-facility">
                    <Building2 size={18} />
                    <div>
                      <strong>{enrollment.hospitalName}</strong>
                      <span>
                        {enrollment.planName}
                        {enrollment.familyPlanOwnerId && (() => {
                          const owner = enrollments.find((e) => e.id === enrollment.familyPlanOwnerId);
                          return owner ? ` · via ${owner.memberName}'s plan` : "";
                        })()}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="sabi-family-hosp-facility empty">
                    <span>No primary facility assigned to {member.name.split(" ")[0]} yet.</span>
                  </div>
                )}

                {enrollment?.status === "Enrolled" ? (
                  <div className="sabi-family-hosp-patient-id">
                    <span>Patient ID: <strong>{enrollment.patientId}</strong></span>
                    <button type="button" className="sabi-btn-outline">View Card</button>
                  </div>
                ) : enrollment?.status === "Pending Approval" ? (
                  <p className="sabi-family-hosp-note">ID will be generated on approval</p>
                ) : enrollment?.status === "Awaiting Member Acceptance" ? (
                  <p className="sabi-family-hosp-note">Waiting for {member.name.split(" ")[0]} to accept this request</p>
                ) : null}

                <button
                  type="button"
                  className="sabi-btn-primary sabi-btn-block"
                  onClick={() => navigate("/hospitals", { state: { enrollMemberId: member.id, enrollMemberName: member.name } })}
                >
                  <UserPlus size={15} /> {enrollment ? "Enroll at Another Hospital" : "Enroll in Hospital"}
                </button>
              </div>
            );
          })}

          <div className="sabi-family-hosp-add-tile" onClick={() => navigate("/family/add")}>
            <UserPlus size={28} />
            <strong>Add New Member</strong>
            <span>Register a new dependent or invite a family member to share access.</span>
            <span className="cta">Get Started</span>
          </div>
        </div>

        <div className="sabi-family-hosp-head" style={{ marginTop: 8 }}>
          <h2>Nearby Partner Facilities</h2>
          <button type="button" className="sabi-hospitals-manage-btn" onClick={() => navigate("/hospitals")}>
            View All Partners
          </button>
        </div>

        <div className="sabi-family-hosp-partners">
          {nearby.map((h) => (
            <div className="sabi-card sabi-family-hosp-partner" key={h.id} onClick={() => navigate(`/hospitals/${h.id}`)}>
              <div className="sabi-hospital-card-icon"><Building2 size={22} /></div>
              <div>
                <strong>{h.name}</strong>
                <span>{h.area}</span>
                <div className="sabi-hospital-tags" style={{ marginTop: 6 }}>
                  {h.departments.slice(0, 2).map((d) => <span key={d}>{d}</span>)}
                  {h.departments.length > 2 && <span>+{h.departments.length - 2} more</span>}
                </div>
              </div>
              <span className="sabi-hospital-rating"><Star size={13} fill="currentColor" /> {h.rating}</span>
              <ChevronRight size={16} className="chevron" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default FamilyHospitalEnrollmentPage;

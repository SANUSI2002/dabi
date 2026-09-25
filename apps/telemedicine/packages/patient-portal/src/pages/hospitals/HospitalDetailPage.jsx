import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Building2, CalendarClock, CheckCircle2, Mail, MapPin, Phone, ShieldCheck, UserPlus } from "lucide-react";

import "../../styles/share.css";
import "./Hospitals.css";

import { useApiData } from "../../api/useApiData";
import { getHospital, listHospitalPlans, listMyEnrollments } from "../../api/sabiApi";
import { LoadState, PageShell, formatNaira } from "./hospitalShared";

export function HospitalDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const hospital = useApiData(() => getHospital(id), [id]);
  const plans = useApiData(() => listHospitalPlans(id), [id]);
  const enrollments = useApiData(() => listMyEnrollments(), []);

  const mine = (enrollments.data || []).filter((e) => e.hospitalId === id);
  const selfEnrollment = mine.find((e) => !e.dependentId);
  const canBook = mine.some((e) => e.status === "ACTIVE");
  const notFound = hospital.error?.status === 404;

  return (
    <PageShell>
      <button className="sabi-rxd-back" onClick={() => navigate("/hospitals")}>
        <ArrowLeft size={18} /> Back to Hospitals
      </button>

      {notFound ? (
        <div className="sabi-card sabi-live-state">
          <Building2 size={32} />
          <h3>We couldn&apos;t find that hospital</h3>
          <p>It may no longer be listed on Sabi.</p>
          <button className="sabi-btn-primary" onClick={() => navigate("/hospitals")}>Back to Hospitals</button>
        </div>
      ) : (
        <LoadState loading={hospital.loading} error={hospital.error} onRetry={hospital.reload} label="Loading hospital…">
          {hospital.data && (
            <>
              <header className="sabi-hospitals-hero">
                <div>
                  <h1>{hospital.data.name}</h1>
                  <p>{hospital.data.typeLabel}{hospital.data.area ? ` · ${hospital.data.area}` : ""} · Verified by Sabi</p>
                  <div className="sabi-hospitals-hero-actions">
                    <button type="button" className="sabi-btn-primary" disabled={!canBook} title={canBook ? undefined : "Enrollment must be approved before booking"} onClick={() => navigate(`/hospitals/${id}/appointment`)}>
                      <CalendarClock size={16} /> Book Appointment
                    </button>
                    <button type="button" className="sabi-hospitals-hero-outline" onClick={() => navigate(`/hospitals/${id}/enroll`)}>
                      <UserPlus size={16} /> {selfEnrollment ? "Enroll a Dependent" : "Enroll as Patient"}
                    </button>
                  </div>
                </div>
                <Building2 size={140} className="sabi-hospitals-hero-icon" />
              </header>

              <div className="sabi-hospitals-layout">
                <div className="sabi-hospitals-directory">
                  <div className="sabi-card">
                    <h3 style={{ margin: "0 0 12px" }}>Contact</h3>
                    <div className="sabi-hospitals-contact-grid">
                      {hospital.data.address && <div><MapPin size={15} /><span>{hospital.data.address}</span></div>}
                      {hospital.data.phone && <div><Phone size={15} /><a href={`tel:${hospital.data.phone}`}>{hospital.data.phone}</a></div>}
                      {hospital.data.email && <div><Mail size={15} /><a href={`mailto:${hospital.data.email}`}>{hospital.data.email}</a></div>}
                    </div>

                    <h4 style={{ margin: "18px 0 8px", fontSize: ".9rem" }}>Enrollment Plans</h4>
                    <LoadState loading={plans.loading} error={plans.error} onRetry={plans.reload} label="Loading plans…">
                      {(plans.data || []).length === 0 ? (
                        <p className="sabi-hospitals-wizard-note">This hospital hasn&apos;t published enrollment plans yet.</p>
                      ) : (
                        <div className="sabi-hospitals-plan-grid">
                          {plans.data.map((plan) => (
                            <div className="sabi-hospitals-plan-card" key={plan.id}>
                              <strong>{plan.name}</strong>
                              <span>{formatNaira(plan.fee)} enrollment fee</span>
                              {plan.description && <span>{plan.description}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </LoadState>

                    <div className="sabi-hospitals-enroll-note">
                      <ShieldCheck size={15} /> The hospital approves each enrollment. Once approved, you can book appointments here.
                    </div>
                  </div>
                </div>

                <aside className="sabi-hospitals-sidebar">
                  <div className="sabi-card sabi-hospitals-memberships">
                    <div className="sabi-hospitals-memberships-head"><h4>Your enrollments here</h4></div>
                    {mine.length === 0 ? (
                      <p className="sabi-hospitals-memberships-empty">No one in your household is enrolled here yet.</p>
                    ) : (
                      <div className="sabi-hospitals-membership-list">
                        {mine.map((e) => (
                          <div className="sabi-hospitals-membership-row" key={e.id}>
                            <span className="icon"><CheckCircle2 size={16} /></span>
                            <div>
                              <p className="name">{e.memberName || "You"}</p>
                              <p className="plan">{e.planName}</p>
                            </div>
                            <span className={`sabi-status-pill ${e.status === "ACTIVE" ? "good" : e.status === "PENDING" ? "pending" : "bad"}`}>{e.statusLabel}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </aside>
              </div>
            </>
          )}
        </LoadState>
      )}
    </PageShell>
  );
}

export default HospitalDetailPage;

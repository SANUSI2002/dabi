import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Check, Clock3, HeartHandshake, Shield, UserPlus, Users, XCircle } from "lucide-react";

import "../../styles/share.css";
import "./Hospitals.css";

import { useApiData } from "../../api/useApiData";
import { listMyEnrollments } from "../../api/sabiApi";
import { LoadState, PageShell, subjectKey, useCareSubjects } from "./hospitalShared";

const pill = (status) =>
  status === "ACTIVE" ? <span className="pill enrolled"><Check size={13} /> Enrolled</span>
    : status === "PENDING" ? <span className="pill pending"><Clock3 size={13} /> Pending Approval</span>
      : <span className="pill not-enrolled"><XCircle size={13} /> Rejected</span>;

export function FamilyHospitalEnrollmentPage() {
  const navigate = useNavigate();
  const { subjects, loading: subjectsLoading, error: subjectsError, reload: reloadSubjects } = useCareSubjects();
  const enrollments = useApiData(() => listMyEnrollments(), []);

  const bySubject = (key) => (enrollments.data || []).filter((e) => subjectKey(e.dependentId) === key);

  return (
    <PageShell placeholder="Search hospitals...">
      <button className="sabi-rxd-back" onClick={() => navigate("/family")}>
        <ArrowLeft size={18} /> Back to Family &amp; Care Circle
      </button>

      <header className="sabi-hospitals-wizard-header">
        <div>
          <h1>Family Hospital Enrollment</h1>
          <p>See every hospital enrollment for you and your dependents in one place, and enroll anyone who isn&apos;t registered yet.</p>
        </div>
      </header>

      <section className="sabi-family-hosp-value-row">
        <div className="sabi-card"><Building2 size={20} /><strong>One place</strong><span>Every enrollment request and its status, per person.</span></div>
        <div className="sabi-card"><Shield size={20} /><strong>Hospital-approved</strong><span>Each hospital reviews and approves its own patients.</span></div>
        <div className="sabi-card"><HeartHandshake size={20} /><strong>Private</strong><span>A hospital only sees enrollments made with it.</span></div>
      </section>

      <div className="sabi-family-hosp-head"><h2>Your Household ({subjects.length})</h2></div>

      <LoadState loading={subjectsLoading || enrollments.loading} error={subjectsError || enrollments.error} onRetry={() => { reloadSubjects(); enrollments.reload(); }} label="Loading enrollments…">
        <div className="sabi-family-hosp-grid">
          {subjects.map((s) => {
            const list = bySubject(s.key);
            return (
              <div className="sabi-card sabi-family-hosp-card" key={s.key}>
                <div className="sabi-family-hosp-card-head">
                  <div className="avatar" aria-hidden="true">{s.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}</div>
                  <div>
                    <strong>{s.name}</strong>
                    <span className="tag">{s.dependentId ? "Dependent" : "Account holder"}</span>
                  </div>
                </div>

                {list.length === 0 ? (
                  <>
                    <div className="sabi-family-hosp-status-row"><span>Enrollment Status</span><span className="pill not-enrolled"><XCircle size={13} /> Not Enrolled</span></div>
                    <div className="sabi-family-hosp-facility empty"><span>Not enrolled at any hospital yet.</span></div>
                  </>
                ) : (
                  list.map((e) => (
                    <div key={e.id}>
                      <div className="sabi-family-hosp-status-row"><span>{e.hospitalName}</span>{pill(e.status)}</div>
                      <div className="sabi-family-hosp-facility">
                        <Building2 size={18} />
                        <div>
                          <strong>{e.planName}</strong>
                          {e.status === "REJECTED" && e.decisionReason && <span>Reason: {e.decisionReason}</span>}
                          {e.status === "ACTIVE" && (
                            <button type="button" className="sabi-btn-outline" style={{ marginTop: 6 }} onClick={() => navigate(`/hospitals/${e.hospitalId}/appointment${e.dependentId ? `?dependentId=${e.dependentId}` : ""}`)}>
                              Book Appointment
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}

                <button type="button" className="sabi-btn-primary sabi-btn-block" onClick={() => navigate("/hospitals", s.dependentId ? { state: { enrollDependentId: s.dependentId, enrollMemberName: s.name } } : undefined)}>
                  <UserPlus size={15} /> {list.length ? "Enroll at Another Hospital" : "Enroll in Hospital"}
                </button>
              </div>
            );
          })}

          <div className="sabi-family-hosp-add-tile" role="button" tabIndex={0} onClick={() => navigate("/family")} onKeyDown={(e) => e.key === "Enter" && navigate("/family")}>
            <Users size={28} />
            <strong>Family &amp; Care Circle</strong>
            <span>Manage the people in your care circle.</span>
            <span className="cta">Open</span>
          </div>
        </div>
      </LoadState>
    </PageShell>
  );
}

export default FamilyHospitalEnrollmentPage;

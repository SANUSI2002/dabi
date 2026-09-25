import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Building2, Check, FileCheck2, Lock, PenLine, RefreshCw, Shield, Calendar } from "lucide-react";

import "../../styles/share.css";
import "./Hospitals.css";

import { useApiData } from "../../api/useApiData";
import { createEnrollment, getHospital, listHospitalPlans, listMyEnrollments } from "../../api/sabiApi";
import { LoadState, PageShell, formatNaira, subjectKey, useCareSubjects } from "./hospitalShared";

const STEPS = [
  { key: "selection", label: "Selection", icon: Check },
  { key: "consent", label: "Consent", icon: PenLine },
  { key: "review", label: "Review", icon: FileCheck2 },
];

function enrollmentErrorMessage(error) {
  if (error.status === 409) return error.message || "This person already has an active or pending enrollment here.";
  if (error.status === 404) return "This hospital or plan is no longer available, or this account can't enroll patients. Refresh and try again.";
  if (error.status === 400) return "Some details weren't accepted. Check the note and try again.";
  return error.message;
}

export function HospitalEnrollmentWizardPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const hospital = useApiData(() => getHospital(id), [id]);
  const plans = useApiData(() => listHospitalPlans(id), [id]);
  const enrollments = useApiData(() => listMyEnrollments(), []);
  const { subjects, loading: subjectsLoading, error: subjectsError } = useCareSubjects();

  const openFor = new Set((enrollments.data || []).filter((e) => e.hospitalId === id && e.status !== "REJECTED").map((e) => subjectKey(e.dependentId)));
  const available = subjects.filter((s) => !openFor.has(s.key));

  const [subject, setSubject] = useState(searchParams.get("dependentId") || null);
  const [planId, setPlanId] = useState(null);
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(null);

  // Default to the first person who can still be enrolled here, and the first plan.
  useEffect(() => {
    if (!enrollments.data || subjectsLoading) return;
    if (!subject || !available.some((s) => s.key === subject)) setSubject(available[0]?.key || null);
  }, [enrollments.data, subjectsLoading]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (plans.data?.length && !planId) setPlanId(plans.data[0].id);
  }, [plans.data, planId]);

  const loading = hospital.loading || plans.loading || enrollments.loading || subjectsLoading;
  const loadError = hospital.error || plans.error || enrollments.error || subjectsError;
  const chosen = subjects.find((s) => s.key === subject);
  const plan = plans.data?.find((p) => p.id === planId);
  const step = STEPS[stepIndex];
  const canAdvance = step.key === "selection" ? Boolean(chosen && plan) : step.key === "consent" ? consent : true;

  const submit = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      setDone(await createEnrollment({ hospitalId: id, planId, dependentId: chosen.dependentId, patientNote: note.trim() || undefined }));
    } catch (error) {
      setSubmitError(enrollmentErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <PageShell mainClassName="sabi-main">
        <div className="sabi-card sabi-hospitals-enroll-success">
          <div className="icon"><Check size={36} /></div>
          <h2>Enrollment submitted</h2>
          <p>
            {chosen?.dependentId ? `${chosen.name}'s` : "Your"} enrollment with {hospital.data?.name} is <strong>Pending Approval</strong>.
            The hospital reviews each request; you&apos;ll be able to book appointments once it&apos;s approved.
            {plan?.fee ? ` The ${formatNaira(plan.fee)} enrollment fee is payable to the hospital after approval.` : ""}
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button type="button" className="sabi-btn-outline" onClick={() => navigate("/hospitals")}>Back to Hospitals</button>
            <button type="button" className="sabi-btn-primary" onClick={() => navigate("/family/hospital-enrollment")}>View Enrollment Status</button>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <button className="sabi-rxd-back" onClick={() => navigate(`/hospitals/${id}`)}>
        <ArrowLeft size={18} /> Back to Hospital
      </button>

      <LoadState loading={loading} error={loadError} onRetry={() => { hospital.reload(); plans.reload(); enrollments.reload(); }} label="Preparing enrollment…">
        {hospital.data && (
          <>
            <header className="sabi-hospitals-wizard-header">
              <div>
                <h1>{hospital.data.name}</h1>
                <p>Request enrollment as a registered patient. The hospital reviews and approves each request.</p>
              </div>
            </header>

            <div className="sabi-hospitals-wizard-steps">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div className={`sabi-hospitals-wizard-step ${i < stepIndex ? "done" : i === stepIndex ? "active" : ""}`} key={s.key}>
                    <span className="dot">{i < stepIndex ? <Check size={13} /> : <Icon size={14} />}</span>
                    {s.label}
                  </div>
                );
              })}
            </div>

            <div className="sabi-hospitals-wizard-layout">
              <div className="sabi-card sabi-hospitals-wizard-card">
                {step.key === "selection" && (
                  <>
                    <h3><Check size={18} /> Who and which plan</h3>
                    {available.length === 0 ? (
                      <p className="sabi-hospitals-wizard-note">
                        Everyone in your household already has an active or pending enrollment at {hospital.data.name}.
                      </p>
                    ) : (
                      <>
                        <p className="sabi-hospitals-wizard-note">Who is this enrollment for?</p>
                        <div className="sabi-subject-picker" role="group" aria-label="Who is this enrollment for">
                          {subjects.map((s) => (
                            <button type="button" key={s.key} aria-pressed={subject === s.key} disabled={openFor.has(s.key)} onClick={() => setSubject(s.key)}>
                              {s.name}{openFor.has(s.key) ? " (already enrolled)" : ""}
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    <p className="sabi-hospitals-wizard-note" style={{ marginTop: 16 }}>Choose a plan</p>
                    {(plans.data || []).length === 0 ? (
                      <p className="sabi-hospitals-wizard-note">This hospital hasn&apos;t published enrollment plans yet, so enrollment isn&apos;t open.</p>
                    ) : (
                      <div className="sabi-hospitals-plan-grid" style={{ marginTop: 8 }}>
                        {plans.data.map((p) => (
                          <button type="button" key={p.id} aria-pressed={planId === p.id} className={`sabi-hospitals-plan-pick ${planId === p.id ? "selected" : ""}`} onClick={() => setPlanId(p.id)}>
                            <strong>{p.name}</strong>
                            <span>{formatNaira(p.fee)} enrollment fee</span>
                            {p.description && <em>{p.description}</em>}
                          </button>
                        ))}
                      </div>
                    )}

                    <label className="sabi-booking-field" style={{ marginTop: 16 }}>
                      <span className="sabi-booking-label">Note for the hospital (optional)</span>
                      <textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Transferring care from another hospital" />
                    </label>
                  </>
                )}

                {step.key === "consent" && (
                  <>
                    <h3><PenLine size={18} /> Consent</h3>
                    <label className="sabi-hospitals-consent-row">
                      <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                      <span>
                        I consent to {hospital.data.name} receiving this enrollment request{chosen?.dependentId ? ` for ${chosen.name}, whom I'm authorised to act for,` : ""} and
                        using it to register {chosen?.dependentId ? "them" : "me"} as a patient. I have read the Sabi Privacy Policy.
                      </span>
                    </label>
                  </>
                )}

                {step.key === "review" && (
                  <>
                    <h3><FileCheck2 size={18} /> Review &amp; Submit</h3>
                    <div className="sabi-hospitals-review-grid">
                      <div><span>Patient</span><strong>{chosen?.name}</strong></div>
                      <div><span>Hospital</span><strong>{hospital.data.name}</strong></div>
                      <div><span>Plan</span><strong>{plan?.name}</strong></div>
                      <div><span>Enrollment fee</span><strong>{formatNaira(plan?.fee)} · paid to the hospital after approval</strong></div>
                    </div>
                  </>
                )}

                {submitError && <p className="sabi-form-error" role="alert">{submitError}</p>}

                <div className="sabi-hospitals-wizard-footer">
                  <button type="button" className="sabi-btn-outline" onClick={() => setStepIndex((i) => i - 1)} disabled={stepIndex === 0 || submitting}>Back</button>
                  {step.key === "review" ? (
                    <button type="button" className="sabi-btn-primary" disabled={submitting} onClick={submit}>
                      {submitting ? "Submitting…" : "Submit Enrollment"} <ArrowRight size={16} />
                    </button>
                  ) : (
                    <button type="button" className="sabi-btn-primary" disabled={!canAdvance} onClick={() => setStepIndex((i) => i + 1)}>
                      Continue <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              </div>

              <aside className="sabi-hospitals-sidebar">
                <div className="sabi-card sabi-hospitals-why-card">
                  <h4><Lock size={16} /> Why Enroll?</h4>
                  <div className="sabi-hospitals-why-item"><Building2 size={16} /><div><strong>Registered Patient</strong><span>The hospital registers you before your first visit.</span></div></div>
                  <div className="sabi-hospitals-why-item"><Calendar size={16} /><div><strong>Online Booking</strong><span>Book and check in to appointments from Sabi once approved.</span></div></div>
                  <div className="sabi-hospitals-why-item"><RefreshCw size={16} /><div><strong>One Account</strong><span>Enroll yourself and your dependents from the same account.</span></div></div>
                  <div className="sabi-hospitals-why-item"><Shield size={16} /><div><strong>NDPR Compliant</strong><span>Your data is encrypted and never shared without consent.</span></div></div>
                </div>
              </aside>
            </div>
          </>
        )}
      </LoadState>
    </PageShell>
  );
}

export default HospitalEnrollmentWizardPage;

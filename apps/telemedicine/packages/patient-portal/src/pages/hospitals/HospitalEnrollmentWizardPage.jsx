import React, { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Bolt, Calendar, Check, ClipboardList, CreditCard,
  FileCheck2, Landmark, Lock, PenLine, Shield, RefreshCw, UploadCloud, User, Wallet,
} from "lucide-react";

import "../../styles/share.css";
import "./Hospitals.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { getHospital, enrollMember } from "./hospitalStore";
import { getMember, getMembers } from "../family/familyStore";

const STEPS = [
  { key: "selection", label: "Selection", icon: Check },
  { key: "personal", label: "Personal", icon: User },
  { key: "medical", label: "Medical", icon: ClipboardList },
  { key: "documents", label: "Documents", icon: UploadCloud },
  { key: "consent", label: "Consent", icon: PenLine },
  { key: "payment", label: "Payment", icon: CreditCard },
  { key: "review", label: "Review", icon: FileCheck2 },
];

const PAYMENT_METHODS = [
  { id: "wallet", label: "Sabi Wallet", sub: "Balance: ₦45,000", icon: Wallet },
  { id: "card", label: "Debit/Credit Card", sub: "Visa, Mastercard, Verve", icon: CreditCard },
  { id: "transfer", label: "Bank Transfer", sub: "Instant confirmation", icon: Landmark },
];

export function HospitalEnrollmentWizardPage() {
  const [zoom] = useZoom();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const hospital = getHospital(id);
  const memberId = searchParams.get("memberId") || "self";
  const member = getMember(memberId) || getMembers()[0];

  const [stepIndex, setStepIndex] = useState(0);
  const [planId, setPlanId] = useState(hospital?.plans[0]?.id);
  const [personal, setPersonal] = useState({
    fullName: member?.name?.replace(/^You \(|\)$/g, "") || "",
    dob: "",
    gender: "",
    phone: "",
    address: "",
  });
  const [medical, setMedical] = useState({ history: "", allergies: member?.allergies?.join(", ") || "", medications: "" });
  const [documents, setDocuments] = useState({ passport: false, nationalId: false, insurance: false });
  const [consent, setConsent] = useState(false);
  const [signed, setSigned] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("wallet");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [includedMembers, setIncludedMembers] = useState([]);
  const [confirmingMember, setConfirmingMember] = useState(null);

  const allMembers = getMembers();
  const availableToAdd = allMembers.filter(
    (m) => m.id !== (member?.id || "self") && !includedMembers.some((im) => im.id === m.id)
  );
  const removeIncludedMember = (id) => setIncludedMembers((prev) => prev.filter((m) => m.id !== id));

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

  const plan = hospital.plans.find((p) => p.id === planId) || hospital.plans[0];
  const step = STEPS[stepIndex];

  const canAdvance = () => {
    if (step.key === "personal") return personal.fullName && personal.phone && personal.address;
    if (step.key === "consent") return consent && signed;
    return true;
  };

  const goNext = () => {
    if (!canAdvance()) return;
    if (stepIndex < STEPS.length - 1) setStepIndex((i) => i + 1);
  };
  const goBack = () => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  };

  const handleFinish = () => {
    setSubmitting(true);
    window.setTimeout(() => {
      enrollMember({
        memberId: member?.id || "self",
        memberName: member?.name || "You",
        hospitalId: hospital.id,
        planId: plan.id,
        personal,
        medical,
        consent: { agreed: consent, signedAt: new Date().toISOString() },
        includedMembers,
      });
      setSubmitting(false);
      setDone(true);
    }, 900);
  };

  if (done) {
    return (
      <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
        <Sidebar />
        <div className="sabi-main">
          <Topbar />
          <div className="sabi-card sabi-hospitals-enroll-success">
            <div className="icon"><Check size={36} /></div>
            <h2>Enrollment submitted</h2>
            <p>
              {member?.name || "Your"} enrollment with {hospital.name} is now <strong>Pending Approval</strong>. We'll
              notify you and generate a digital patient ID once the hospital confirms — usually within a few minutes.
            </p>
            {includedMembers.length > 0 && (
              <div className="sabi-hospitals-family-plan-list" style={{ justifyContent: "center" }}>
                {includedMembers.map((m) => (
                  <div className="sabi-hospitals-family-plan-chip" key={m.id}>{m.name} — also enrolled</div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button type="button" className="sabi-btn-outline" onClick={() => navigate("/hospitals")}>Back to Hospitals</button>
              <button type="button" className="sabi-btn-primary" onClick={() => navigate("/family/hospital-enrollment")}>
                View Enrollment Status
              </button>
            </div>
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

        <header className="sabi-hospitals-wizard-header">
          <div>
            <h1>{hospital.name}</h1>
            <p>
              Complete {member?.id !== "self" ? `${member?.name}'s` : "your"} registration to access full digital
              services including direct records sync and priority booking.
            </p>
          </div>
          <span className="sabi-hospitals-tier-tag">Tier 1 Provider</span>
        </header>

        <div className="sabi-hospitals-wizard-steps">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const state = i < stepIndex ? "done" : i === stepIndex ? "active" : "";
            return (
              <div className={`sabi-hospitals-wizard-step ${state}`} key={s.key}>
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
                <h3><Check size={18} /> Confirm Selection</h3>
                <p className="sabi-hospitals-wizard-note">Enrolling <strong>{member?.name || "you"}</strong> at {hospital.name}.</p>
                <div className="sabi-hospitals-plan-grid" style={{ marginTop: 12 }}>
                  {hospital.plans.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      className={`sabi-hospitals-plan-pick ${planId === p.id ? "selected" : ""}`}
                      onClick={() => setPlanId(p.id)}
                    >
                      <strong>{p.name}</strong>
                      <span>₦{p.fee.toLocaleString()} enrollment fee</span>
                      {p.description && <em>{p.description}</em>}
                    </button>
                  ))}
                </div>

                {plan?.type === "family" && (
                  <div className="sabi-hospitals-family-plan-box">
                    <div className="sabi-hospitals-family-plan-head">
                      <span>Family members on this plan ({includedMembers.length}/{plan.maxMembers || 5})</span>
                    </div>

                    {includedMembers.length > 0 && (
                      <div className="sabi-hospitals-family-plan-list">
                        {includedMembers.map((m) => (
                          <div className="sabi-hospitals-family-plan-chip" key={m.id}>
                            {m.name}{m.isDependent === false ? " (request sent)" : ""}
                            <button type="button" onClick={() => removeIncludedMember(m.id)} aria-label={`Remove ${m.name}`}>×</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {availableToAdd.length > 0 ? (
                      <div className="sabi-hospitals-family-plan-picker">
                        {availableToAdd.map((m) => (
                          <button
                            type="button"
                            key={m.id}
                            className="sabi-hospitals-family-plan-add-btn"
                            disabled={includedMembers.length >= (plan.maxMembers || 5)}
                            onClick={() => setConfirmingMember(m)}
                          >
                            + Add {m.name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="sabi-hospitals-wizard-note" style={{ margin: 0 }}>
                        Everyone in your Family &amp; Care Circle is already on this plan.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {step.key === "personal" && (
              <>
                <h3><User size={18} /> Personal Information</h3>
                <p className="sabi-hospitals-wizard-note">These details are synced from your Sabi Health profile.</p>
                <div className="sabi-hospitals-form-grid">
                  <label className="sabi-booking-field">
                    <span className="sabi-booking-label">Full Name</span>
                    <input type="text" value={personal.fullName} onChange={(e) => setPersonal((p) => ({ ...p, fullName: e.target.value }))} />
                  </label>
                  <label className="sabi-booking-field">
                    <span className="sabi-booking-label">Date of Birth</span>
                    <input type="date" value={personal.dob} onChange={(e) => setPersonal((p) => ({ ...p, dob: e.target.value }))} />
                  </label>
                  <label className="sabi-booking-field">
                    <span className="sabi-booking-label">Gender</span>
                    <select value={personal.gender} onChange={(e) => setPersonal((p) => ({ ...p, gender: e.target.value }))}>
                      <option value="">Select</option>
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                    </select>
                  </label>
                  <label className="sabi-booking-field">
                    <span className="sabi-booking-label">Phone Number</span>
                    <input type="text" placeholder="+234 8xx xxx xxxx" value={personal.phone} onChange={(e) => setPersonal((p) => ({ ...p, phone: e.target.value }))} />
                  </label>
                  <label className="sabi-booking-field" style={{ gridColumn: "span 2" }}>
                    <span className="sabi-booking-label">Residential Address</span>
                    <input type="text" value={personal.address} onChange={(e) => setPersonal((p) => ({ ...p, address: e.target.value }))} />
                  </label>
                </div>
              </>
            )}

            {step.key === "medical" && (
              <>
                <h3><ClipboardList size={18} /> Medical Background</h3>
                <div className="sabi-hospitals-form-grid" style={{ gridTemplateColumns: "1fr" }}>
                  <label className="sabi-booking-field">
                    <span className="sabi-booking-label">Medical History</span>
                    <textarea rows={2} value={medical.history} onChange={(e) => setMedical((m) => ({ ...m, history: e.target.value }))} />
                  </label>
                  <label className="sabi-booking-field">
                    <span className="sabi-booking-label">Drug Allergies</span>
                    <input type="text" value={medical.allergies} onChange={(e) => setMedical((m) => ({ ...m, allergies: e.target.value }))} />
                  </label>
                  <label className="sabi-booking-field">
                    <span className="sabi-booking-label">Current Medications</span>
                    <input type="text" value={medical.medications} onChange={(e) => setMedical((m) => ({ ...m, medications: e.target.value }))} />
                  </label>
                </div>
              </>
            )}

            {step.key === "documents" && (
              <>
                <h3><UploadCloud size={18} /> Identity Verification</h3>
                <div className="sabi-hospitals-doc-grid">
                  {[
                    { key: "passport", label: "Passport Photo" },
                    { key: "nationalId", label: "National ID" },
                    { key: "insurance", label: "Insurance Card" },
                  ].map((doc) => (
                    <button
                      type="button"
                      key={doc.key}
                      className={`sabi-hospitals-doc-tile ${documents[doc.key] ? "uploaded" : ""}`}
                      onClick={() => setDocuments((d) => ({ ...d, [doc.key]: !d[doc.key] }))}
                    >
                      <UploadCloud size={22} />
                      <strong>{doc.label}</strong>
                      <span>{documents[doc.key] ? "Uploaded" : "Click to Upload"}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {step.key === "consent" && (
              <>
                <h3><PenLine size={18} /> Consent &amp; Agreement</h3>
                <label className="sabi-hospitals-consent-row">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  <span>
                    I hereby consent to the sharing of my medical information with {hospital.name} for clinical
                    treatment purposes. I have read and agree to the Privacy Policy and Hospital Terms of Service.
                  </span>
                </label>
                <div className="sabi-hospitals-signature">
                  <span className="sabi-booking-label">Digital Signature</span>
                  <button type="button" className={`sabi-hospitals-signature-pad ${signed ? "signed" : ""}`} onClick={() => setSigned((s) => !s)}>
                    {signed ? `Signed by ${personal.fullName || member?.name || "patient"}` : "Click to sign"}
                  </button>
                </div>
              </>
            )}

            {step.key === "payment" && (
              <>
                <h3><CreditCard size={18} /> Enrollment Payment</h3>
                <p className="sabi-hospitals-wizard-note">Complete your registration payment to finalize enrollment with {hospital.name}.</p>
                <div className="sabi-hospitals-payment-summary">
                  <div><span>Enrollment Fee</span><span>₦{plan.fee.toLocaleString()}</span></div>
                  <div><span>Digital ID Processing</span><span>₦2,500</span></div>
                  <div className="total"><span>Total</span><span>₦{(plan.fee + 2500).toLocaleString()}</span></div>
                </div>
                <div className="sabi-hospitals-payment-methods">
                  {PAYMENT_METHODS.map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        type="button"
                        key={m.id}
                        className={`sabi-hospitals-payment-card ${paymentMethod === m.id ? "selected" : ""}`}
                        onClick={() => setPaymentMethod(m.id)}
                      >
                        <Icon size={18} />
                        <div>
                          <strong>{m.label}</strong>
                          <span>{m.sub}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {step.key === "review" && (
              <>
                <h3><FileCheck2 size={18} /> Review &amp; Submit</h3>
                <div className="sabi-hospitals-review-grid">
                  <div><span>Patient</span><strong>{personal.fullName || member?.name}</strong></div>
                  <div><span>Hospital</span><strong>{hospital.name}</strong></div>
                  <div><span>Plan</span><strong>{plan.name}</strong></div>
                  <div><span>Phone</span><strong>{personal.phone || "—"}</strong></div>
                  <div><span>Payment Method</span><strong>{PAYMENT_METHODS.find((m) => m.id === paymentMethod)?.label}</strong></div>
                  <div><span>Total</span><strong>₦{(plan.fee + 2500).toLocaleString()}</strong></div>
                </div>
              </>
            )}

            <div className="sabi-hospitals-wizard-footer">
              <button type="button" className="sabi-btn-outline" onClick={goBack} disabled={stepIndex === 0}>
                Back
              </button>
              {step.key === "review" ? (
                <button type="button" className="sabi-btn-primary" disabled={submitting} onClick={handleFinish}>
                  {submitting ? "Submitting…" : "Enroll Now"} <ArrowRight size={16} />
                </button>
              ) : (
                <button type="button" className="sabi-btn-primary" disabled={!canAdvance()} onClick={goNext}>
                  Continue <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>

          <aside className="sabi-hospitals-sidebar">
            <div className="sabi-card sabi-hospitals-why-card">
              <h4><Lock size={16} /> Why Enroll?</h4>
              <div className="sabi-hospitals-why-item"><RefreshCw size={16} /><div><strong>Automatic Sync</strong><span>Your vitals and history are instantly shared with your physician.</span></div></div>
              <div className="sabi-hospitals-why-item"><Bolt size={16} /><div><strong>Fast-Track Entry</strong><span>Skip the reception paperwork on your first physical visit.</span></div></div>
              <div className="sabi-hospitals-why-item"><Calendar size={16} /><div><strong>Priority Booking</strong><span>Get access to exclusive digital consultation slots.</span></div></div>
              <div className="sabi-hospitals-why-item"><Shield size={16} /><div><strong>NDPR Compliant</strong><span>Your data is encrypted and never shared without consent.</span></div></div>
            </div>
          </aside>
        </div>

        {confirmingMember && (
          <div className="sabi-modal-overlay" onClick={() => setConfirmingMember(null)}>
            <div className="sabi-modal sabi-hospitals-confirm-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <h3>Add {confirmingMember.name} to this plan?</h3>
              <p>
                {confirmingMember.isDependent === false ? (
                  <>
                    {confirmingMember.name} manages their own Sabi Health account, so we'll send them a request to join{" "}
                    {hospital.name}&apos;s {plan?.name} — they'll need to accept it before their enrollment is submitted.
                  </>
                ) : (
                  <>
                    {confirmingMember.name} will be covered under {hospital.name}&apos;s {plan?.name} alongside{" "}
                    {member?.name || "you"}, and will get their own digital patient ID once approved.
                  </>
                )}
              </p>
              <div className="sabi-hospitals-confirm-actions">
                <button type="button" className="sabi-btn-outline" onClick={() => setConfirmingMember(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="sabi-btn-primary"
                  onClick={() => {
                    setIncludedMembers((prev) => [...prev, confirmingMember]);
                    setConfirmingMember(null);
                  }}
                >
                  {confirmingMember.isDependent === false ? `Send Request` : `Yes, Add ${confirmingMember.name.split(" ")[0]}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default HospitalEnrollmentWizardPage;

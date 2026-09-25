import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, User, Stethoscope, HeartHandshake, ShieldCheck, Users2, X, Plus, Loader2 } from "lucide-react";

import "../../styles/share.css";
import "./FamilyCircle.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { LoadState } from "../hospitals/hospitalShared";
import { useApiData } from "../../api/useApiData";
import { createDependent, getCircle, getDependent, initialsOf, updateDependent } from "../../api/familyApi";
import { BLOOD_GROUPS, GENOTYPES, IMMUNIZATION_OPTIONS, MOBILITY_CHECKS, PEDIATRIC_MILESTONES, colorFor } from "./data";

const EMPTY = {
  fullName: "", nickname: "", dateOfBirth: "", gender: "", bloodGroup: "", genotype: "",
  allergies: [], conditions: [], careType: "Child", immunizationStatus: "", milestones: [],
  weightKg: "", heightCm: "", primaryPhysician: "", insuranceProvider: "", policyNumber: "", coManagerIds: [],
};

const fromDependent = (d) => ({
  ...EMPTY,
  ...Object.fromEntries(Object.entries(d).filter(([k, v]) => k in EMPTY && v != null)),
  dateOfBirth: d.dateOfBirth ? String(d.dateOfBirth).slice(0, 10) : "",
  weightKg: d.weightKg ?? "",
  heightCm: d.heightCm ?? "",
});

/** API body: blanks become null (clearing a value on edit) or are left out (on create). */
function toBody(f, editing) {
  const blank = editing ? null : undefined;
  const text = (v) => (v && v.trim() ? v.trim() : blank);
  const num = (v) => (v === "" || v == null ? blank : Number(v));
  const body = {
    fullName: f.fullName.trim(),
    nickname: text(f.nickname),
    dateOfBirth: f.dateOfBirth || blank,
    gender: f.gender || blank,
    bloodGroup: f.bloodGroup || blank,
    genotype: f.genotype || blank,
    allergies: f.allergies,
    conditions: f.conditions,
    careType: f.careType || blank,
    immunizationStatus: f.immunizationStatus || blank,
    milestones: f.milestones,
    weightKg: num(f.weightKg),
    heightCm: num(f.heightCm),
    primaryPhysician: text(f.primaryPhysician),
    insuranceProvider: text(f.insuranceProvider),
    policyNumber: text(f.policyNumber),
    coManagerIds: f.coManagerIds,
  };
  return Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
}

function ChipInput({ label, values, onChange, placeholder }) {
  const [input, setInput] = useState("");
  const add = () => {
    const value = input.trim();
    if (value && !values.includes(value) && values.length < 50) onChange([...values, value.slice(0, 120)]);
    setInput("");
  };
  return (
    <div className="sabi-fam-field">
      <label>{label}</label>
      <div className="sabi-fam-chips-editable">
        {values.map((c) => (
          <span className="sabi-fam-chip-removable" key={c}>
            {c} <button type="button" aria-label={`Remove ${c}`} onClick={() => onChange(values.filter((x) => x !== c))}><X size={12} /></button>
          </span>
        ))}
        <input
          type="text"
          placeholder={placeholder}
          value={input}
          maxLength={120}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          className="sabi-fam-chip-input"
        />
        <button type="button" className="sabi-fam-chip-add" onClick={add}><Plus size={12} /> Add</button>
      </div>
    </div>
  );
}

export function SetupDependentPage() {
  const [zoom] = useZoom();
  const navigate = useNavigate();
  const { memberId } = useParams();
  const editing = Boolean(memberId);

  const existing = useApiData(() => (editing ? getDependent(memberId) : Promise.resolve(null)), [memberId]);
  const circle = useApiData(getCircle, []);
  const [form, setForm] = useState(editing ? null : EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (editing && existing.data) setForm(fromDependent(existing.data));
  }, [editing, existing.data]);

  // Co-managers must be active members who can see your profile & dependents.
  const managers = (circle.data?.members || []).filter((m) => m.state === "active" && m.permissions.includes("PROFILE"));
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const toggle = (key, value) => setForm((f) => ({ ...f, [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value] }));
  const careChecks = form?.careType === "Elderly" ? MOBILITY_CHECKS : PEDIATRIC_MILESTONES;

  const setCareType = (careType) =>
    setForm((f) => ({ ...f, careType, milestones: f.milestones.filter((m) => (careType === "Elderly" ? MOBILITY_CHECKS : PEDIATRIC_MILESTONES).includes(m)) }));

  const save = async () => {
    if (!form.fullName.trim()) {
      setError("Enter their full name.");
      return;
    }
    if (form.dateOfBirth && form.dateOfBirth > new Date().toISOString().slice(0, 10)) {
      setError("Date of birth can't be in the future.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Drop co-managers who have since lost access; the server rejects them.
      const coManagerIds = circle.data ? form.coManagerIds.filter((id) => managers.some((m) => m.id === id)) : form.coManagerIds;
      const body = toBody({ ...form, coManagerIds }, editing);
      if (editing) {
        await updateDependent(memberId, body);
        navigate(`/family/member/${memberId}`, { replace: true });
      } else {
        const dependent = await createDependent(body);
        navigate("/family/add/success", { replace: true, state: { kind: "dependent", dependent } });
      }
    } catch (err) {
      setError(err.errors?.map((e) => e.message).join(" ") || err.message);
      setSaving(false);
    }
  };

  const back = () => navigate(editing ? `/family/member/${memberId}` : "/family");

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar placeholder="Search members, records..." />

        <button className="sabi-rxd-back" onClick={back} style={{ marginBottom: 12 }}>
          <ArrowLeft size={16} /> {editing ? "Back to Profile" : "Back to Family Circle"}
        </button>

        <div className="sabi-fam-header">
          <div>
            <h1>{editing ? "Edit Dependent Profile" : "Setup Dependent Profile"}</h1>
            <p>Health details for someone you care for who doesn&apos;t have their own account. Only you, and co-managers you choose, can see them.</p>
          </div>
        </div>

        <LoadState loading={!form && !existing.error} error={existing.error} onRetry={existing.reload} label="Loading profile…">
          {form && (
            <>
              <div className="sabi-card">
                <div className="sabi-fam-dep-section-title"><User size={16} /> Profile Basics</div>
                <div className="sabi-fam-form-grid sabi-fam-grid-2">
                  <div className="sabi-fam-field">
                    <label htmlFor="dep-name">Full Name</label>
                    <input id="dep-name" type="text" placeholder="e.g. Samuel Adeyemi" value={form.fullName} onChange={(e) => set("fullName")(e.target.value)} maxLength={160} />
                  </div>
                  <div className="sabi-fam-field">
                    <label htmlFor="dep-nick">Nickname (Optional)</label>
                    <input id="dep-nick" type="text" placeholder="e.g. Sam" value={form.nickname} onChange={(e) => set("nickname")(e.target.value)} maxLength={100} />
                  </div>
                  <div className="sabi-fam-field">
                    <label htmlFor="dep-dob">Date of Birth</label>
                    <input id="dep-dob" type="date" value={form.dateOfBirth} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set("dateOfBirth")(e.target.value)} />
                  </div>
                  <div className="sabi-fam-field">
                    <label htmlFor="dep-gender">Gender</label>
                    <select id="dep-gender" value={form.gender} onChange={(e) => set("gender")(e.target.value)}>
                      <option value="">Not specified</option>
                      <option>Male</option>
                      <option>Female</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="sabi-card sabi-fam-dep-section">
                <div className="sabi-fam-dep-section-title"><Stethoscope size={16} /> Clinical Identity</div>
                <div className="sabi-fam-form-grid sabi-fam-grid-2">
                  <div className="sabi-fam-field">
                    <label>Blood Group</label>
                    <div className="sabi-fam-blood-group" role="radiogroup" aria-label="Blood group">
                      {BLOOD_GROUPS.map((b) => (
                        <button key={b} type="button" role="radio" aria-checked={form.bloodGroup === b} className={form.bloodGroup === b ? "active" : ""} onClick={() => set("bloodGroup")(form.bloodGroup === b ? "" : b)}>{b}</button>
                      ))}
                    </div>
                    <small className="sabi-fam-muted">{form.bloodGroup ? "Tap again to clear." : "Leave unselected if you don't know it."}</small>
                  </div>
                  <div className="sabi-fam-field">
                    <label htmlFor="dep-genotype">Genotype</label>
                    <select id="dep-genotype" value={form.genotype} onChange={(e) => set("genotype")(e.target.value)}>
                      <option value="">Not known</option>
                      {GENOTYPES.map((g) => <option key={g}>{g}</option>)}
                    </select>
                  </div>
                  <ChipInput label="Known Allergies" values={form.allergies} onChange={set("allergies")} placeholder="Add allergy" />
                  <ChipInput label="Chronic Conditions" values={form.conditions} onChange={set("conditions")} placeholder="Add condition" />
                </div>
              </div>

              <div className="sabi-card sabi-fam-dep-section">
                <div className="sabi-fam-section-head" style={{ marginBottom: 12 }}>
                  <div className="sabi-fam-dep-section-title" style={{ marginBottom: 0 }}><HeartHandshake size={16} /> Specialized Care Needs</div>
                  <div className="sabi-fam-toggle-group">
                    <button type="button" className={form.careType === "Child" ? "active" : ""} onClick={() => setCareType("Child")}>Child</button>
                    <button type="button" className={form.careType === "Elderly" ? "active" : ""} onClick={() => setCareType("Elderly")}>Elderly</button>
                  </div>
                </div>
                <div className="sabi-fam-form-grid sabi-fam-grid-3">
                  <div className="sabi-fam-field">
                    <label htmlFor="dep-immunization">Immunization Status</label>
                    <select id="dep-immunization" value={form.immunizationStatus} onChange={(e) => set("immunizationStatus")(e.target.value)}>
                      <option value="">Not recorded</option>
                      {IMMUNIZATION_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="sabi-fam-field">
                    <label>{form.careType === "Elderly" ? "Mobility & Safety" : "Pediatric Milestones"}</label>
                    <div className="sabi-fam-checklist">
                      {careChecks.map((m) => (
                        <label key={m}>
                          <input type="checkbox" checked={form.milestones.includes(m)} onChange={() => toggle("milestones", m)} /> {m}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="sabi-fam-field">
                    <label>Growth Tracking (Weight / Height)</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input type="number" inputMode="decimal" min="0.1" max="1000" step="0.1" placeholder="Kg" aria-label="Weight in kilograms" value={form.weightKg} onChange={(e) => set("weightKg")(e.target.value)} />
                      <input type="number" inputMode="decimal" min="1" max="400" step="0.1" placeholder="Cm" aria-label="Height in centimetres" value={form.heightCm} onChange={(e) => set("heightCm")(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="sabi-fam-form-grid sabi-fam-grid-2" style={{ marginTop: "var(--sabi-space-lg)" }}>
                <div className="sabi-card">
                  <div className="sabi-fam-dep-section-title"><ShieldCheck size={16} /> Primary Care Details</div>
                  <div className="sabi-fam-field" style={{ marginBottom: 12 }}>
                    <label htmlFor="dep-physician">Primary Physician</label>
                    <input id="dep-physician" type="text" placeholder="Dr. Name or Clinic" value={form.primaryPhysician} onChange={(e) => set("primaryPhysician")(e.target.value)} maxLength={200} />
                  </div>
                  <div className="sabi-fam-form-grid sabi-fam-grid-2">
                    <div className="sabi-fam-field">
                      <label htmlFor="dep-insurer">Insurance Provider</label>
                      <input id="dep-insurer" type="text" placeholder="e.g. Reliance HMO" value={form.insuranceProvider} onChange={(e) => set("insuranceProvider")(e.target.value)} maxLength={200} />
                    </div>
                    <div className="sabi-fam-field">
                      <label htmlFor="dep-policy">Policy Number</label>
                      <input id="dep-policy" type="text" placeholder="ID-000000" value={form.policyNumber} onChange={(e) => set("policyNumber")(e.target.value)} maxLength={100} />
                    </div>
                  </div>
                </div>

                <div className="sabi-card">
                  <div className="sabi-fam-dep-section-title"><Users2 size={16} /> Care Coordination</div>
                  <p className="sabi-fam-section-note">Circle members who should also see this profile. Only active members with Profile &amp; Dependents access can be chosen.</p>
                  {managers.length === 0 ? (
                    <p className="sabi-modal-empty">No eligible members yet.</p>
                  ) : (
                    managers.map((m) => (
                      <div className="sabi-fam-coordination-row" key={m.id}>
                        <div className="who">
                          <div className="sabi-fam-avatar" style={{ background: colorFor(m.id), width: 34, height: 34, fontSize: "0.78rem" }}>{initialsOf(m.name)}</div>
                          <div>
                            <strong>{m.name}</strong>
                            <span>{m.relationship || "Member"}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={form.coManagerIds.includes(m.id)}
                          aria-label={`Let ${m.name} co-manage`}
                          className={`sabi-fam-coordination-check ${form.coManagerIds.includes(m.id) ? "checked" : ""}`}
                          onClick={() => toggle("coManagerIds", m.id)}
                        >
                          ✓
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {error && <p className="sabi-form-error" role="alert">{error}</p>}
              <div className="sabi-fam-form-footer" style={{ border: "none", marginTop: 8 }}>
                <button type="button" className="sabi-btn-outline" onClick={back} disabled={saving}>Cancel</button>
                <button type="button" className="sabi-btn-primary" onClick={save} disabled={saving}>
                  {saving && <Loader2 size={15} className="sabi-spin" />} {editing ? "Save Changes" : "Create Profile"}
                </button>
              </div>
            </>
          )}
        </LoadState>
      </div>
    </div>
  );
}

export default SetupDependentPage;

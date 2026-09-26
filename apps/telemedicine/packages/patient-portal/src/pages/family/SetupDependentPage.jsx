import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Camera, Pencil, User, Stethoscope, HeartHandshake,
  ShieldCheck, Users2, X, Plus, UserPlus2,
} from "lucide-react";

import "../../styles/share.css";
import "./FamilyCircle.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { addDependent, getMembers, createCircleInvite } from "./familyStore";
import { BLOOD_GROUPS, GENOTYPES, DEFAULT_ACCESS_BY_LEVEL, colorFor } from "./data";
import { useApiData } from "../../api/useApiData";
import { initialsOf, inviteUrl } from "../../api/familyApi";

const PEDIATRIC_MILESTONES = ["Smiling & Cooing", "Rolling Over", "Sitting Unassisted"];
const MOBILITY_CHECKS = ["Independent Mobility", "Uses Walking Aid", "Fall Risk Assessment Done"];

export function SetupDependentPage() {
  const [zoom] = useZoom();
  const navigate = useNavigate();
  const { state } = useLocation();
  const permission = state?.permission || "care-manager";
  const access = state?.access || DEFAULT_ACCESS_BY_LEVEL[permission];
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [genotype, setGenotype] = useState("");
  const [allergies, setAllergies] = useState("");
  const [conditions, setConditions] = useState([]);
  const [conditionInput, setConditionInput] = useState("");
  const [profileType, setProfileType] = useState("Child");
  const [milestones, setMilestones] = useState({});
  const [immunization, setImmunization] = useState("Up to date");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [physician, setPhysician] = useState("");
  const [insurance, setInsurance] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");

  // Co-managers are active circle members whose access includes managing profiles.
  const { data: circleMembers } = useApiData(getMembers, []);
  const existingMembers = (circleMembers || []).filter((m) => m.canManageDependents);
  const [coManagers, setCoManagers] = useState(() => new Set());

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  const toggleMilestone = (label) => setMilestones((prev) => ({ ...prev, [label]: !prev[label] }));

  const addCondition = () => {
    const value = conditionInput.trim();
    if (!value) return;
    setConditions((prev) => [...prev, value]);
    setConditionInput("");
  };

  const removeCondition = (c) => setConditions((prev) => prev.filter((item) => item !== c));

  const toggleManager = (id) => {
    setCoManagers((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const optional = (value) => value.trim() || null;
  const measure = (value) => (value.trim() && Number(value) > 0 ? Number(value) : null);

  const handleCreate = async () => {
    if (!fullName.trim()) {
      notify("Full name is required");
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const created = await addDependent({
        fullName: fullName.trim(),
        nickname: optional(nickname),
        dateOfBirth: dob || null,
        gender: gender || null,
        bloodGroup: bloodGroup || null,
        genotype: genotype || null,
        allergies: allergies ? allergies.split(",").map((a) => a.trim()).filter(Boolean) : [],
        conditions,
        careType: profileType,
        immunizationStatus: immunization,
        milestones: (profileType === "Child" ? PEDIATRIC_MILESTONES : MOBILITY_CHECKS).filter((m) => milestones[m]),
        weightKg: measure(weight),
        heightCm: measure(height),
        primaryPhysician: optional(physician),
        insuranceProvider: optional(insurance),
        policyNumber: optional(policyNumber),
        coManagerIds: Array.from(coManagers),
      });
      const member = {
        id: created.id,
        name: created.fullName,
        initials: initialsOf(created.fullName),
        color: colorFor(created.id),
        relationship: profileType === "Child" ? "Child" : "Dependent",
        sabiHealthId: `SABI-${created.id.slice(0, 8).toUpperCase()}`,
      };
      navigate("/family/add/success", { state: { kind: "dependent", member, permission, access } });
    } catch (err) {
      notify(err.message);
      setSaving(false);
    }
  };

  const shareInvite = async () => {
    try {
      const token = await createCircleInvite("care-manager");
      await navigator.clipboard?.writeText(inviteUrl(token)).catch(() => {});
      notify("Invite link copied to clipboard");
    } catch (err) {
      notify(err.message);
    }
  };

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar placeholder="Search members, records..." />

        <button className="sabi-rxd-back" onClick={() => navigate("/family/add")} style={{ marginBottom: 12 }}>
          <ArrowLeft size={16} /> Back to Add Member
        </button>

        <div className="sabi-fam-header">
          <div>
            <h1>Setup Dependent Profile</h1>
            <p>Complete the health profile for your loved one to ensure they receive coordinated care and precise medical attention.</p>
          </div>
        </div>

        <div className="sabi-fam-dep-layout">
          <div className="sabi-fam-photo-upload">
            <div className="sabi-fam-photo-circle">
              <Camera size={26} />
              <span className="edit"><Pencil size={13} /></span>
            </div>
            <strong style={{ fontSize: "0.9rem" }}>Profile Photo</strong>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--sabi-text-secondary)" }}>
              Clear face photo helps clinicians identify your dependent
            </p>
          </div>

          <div className="sabi-card">
            <div className="sabi-fam-dep-section-title"><User size={16} /> Profile Basics</div>
            <div className="sabi-fam-form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="sabi-fam-field">
                <label>Full Name</label>
                <input type="text" placeholder="e.g. Samuel Adeyemi" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="sabi-fam-field">
                <label>Nickname (Optional)</label>
                <input type="text" placeholder="e.g. Sam" value={nickname} onChange={(e) => setNickname(e.target.value)} />
              </div>
              <div className="sabi-fam-field">
                <label>Date of Birth</label>
                <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
              </div>
              <div className="sabi-fam-field">
                <label>Gender</label>
                <select value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">Select gender</option>
                  <option>Male</option>
                  <option>Female</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="sabi-card sabi-fam-dep-section">
          <div className="sabi-fam-dep-section-title"><Stethoscope size={16} /> Clinical Identity</div>
          <div className="sabi-fam-form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <div className="sabi-fam-field">
              <label>Blood Group</label>
              <div className="sabi-fam-blood-group">
                {BLOOD_GROUPS.slice(0, 4).map((b) => (
                  <button key={b} type="button" className={bloodGroup === b ? "active" : ""} onClick={() => setBloodGroup(b)}>{b}</button>
                ))}
              </div>
            </div>
            <div className="sabi-fam-field">
              <label>Known Allergies</label>
              <textarea placeholder="List all known allergies (medication, food, etc.)" value={allergies} onChange={(e) => setAllergies(e.target.value)} style={{ minHeight: 44 }} />
            </div>
            <div className="sabi-fam-field">
              <label>Chronic Conditions</label>
              <div className="sabi-fam-chips-editable">
                {conditions.map((c) => (
                  <span className="sabi-fam-chip-removable" key={c}>
                    {c} <button type="button" onClick={() => removeCondition(c)}><X size={12} /></button>
                  </span>
                ))}
                <input
                  type="text"
                  placeholder="Add condition"
                  value={conditionInput}
                  onChange={(e) => setConditionInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCondition())}
                  style={{ width: 130, padding: "6px 10px", border: "1px dashed var(--sabi-border)", borderRadius: 999, fontSize: "0.78rem" }}
                />
                <button type="button" className="sabi-fam-chip-add" onClick={addCondition}><Plus size={12} /> Add</button>
              </div>
            </div>
          </div>
          <div className="sabi-fam-field" style={{ marginTop: 16, maxWidth: 220 }}>
            <label>Genotype</label>
            <select value={genotype} onChange={(e) => setGenotype(e.target.value)}>
              <option value="">Select genotype</option>
              {GENOTYPES.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
        </div>

        <div className="sabi-card sabi-fam-dep-section">
          <div className="sabi-fam-section-head" style={{ marginBottom: 12 }}>
            <div className="sabi-fam-dep-section-title" style={{ marginBottom: 0 }}>
              <HeartHandshake size={16} /> Specialized Care Needs
            </div>
            <div className="sabi-fam-toggle-group">
              <button type="button" className={profileType === "Child" ? "active" : ""} onClick={() => setProfileType("Child")}>Child</button>
              <button type="button" className={profileType === "Elderly" ? "active" : ""} onClick={() => setProfileType("Elderly")}>Elderly</button>
            </div>
          </div>

          <div className="sabi-fam-form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <div className="sabi-fam-field">
              <label>Immunization Status</label>
              <select value={immunization} onChange={(e) => setImmunization(e.target.value)}>
                <option>Up to date</option>
                <option>Partially complete</option>
                <option>Not started</option>
              </select>
            </div>
            <div className="sabi-fam-field">
              <label>{profileType === "Child" ? "Pediatric Milestones" : "Mobility & Safety"}</label>
              <div className="sabi-fam-checklist">
                {(profileType === "Child" ? PEDIATRIC_MILESTONES : MOBILITY_CHECKS).map((m) => (
                  <label key={m}>
                    <input type="checkbox" checked={!!milestones[m]} onChange={() => toggleMilestone(m)} /> {m}
                  </label>
                ))}
              </div>
            </div>
            <div className="sabi-fam-field">
              <label>Growth Tracking (Weight/Height)</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="text" inputMode="decimal" placeholder="Kg" value={weight} onChange={(e) => setWeight(e.target.value)} />
                <input type="text" inputMode="decimal" placeholder="Cm" value={height} onChange={(e) => setHeight(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="sabi-fam-dep-layout">
          <div />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sabi-space-lg)" }}>
            <div className="sabi-card">
              <div className="sabi-fam-dep-section-title"><ShieldCheck size={16} /> Primary Care Details</div>
              <div className="sabi-fam-field" style={{ marginBottom: 12 }}>
                <label>Primary Physician</label>
                <input type="text" placeholder="Dr. Name or Clinic" value={physician} onChange={(e) => setPhysician(e.target.value)} />
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div className="sabi-fam-field" style={{ flex: 1 }}>
                  <label>Insurance Provider</label>
                  <input type="text" placeholder="e.g. Reliance HMO" value={insurance} onChange={(e) => setInsurance(e.target.value)} />
                </div>
                <div className="sabi-fam-field" style={{ flex: 1 }}>
                  <label>Policy Number</label>
                  <input type="text" placeholder="ID-000000" value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="sabi-card">
              <div className="sabi-fam-dep-section-title"><Users2 size={16} /> Care Coordination</div>
              <p style={{ margin: "0 0 12px", fontSize: "0.82rem", color: "var(--sabi-text-secondary)" }}>
                Select circle members who should also manage this profile.
              </p>
              {existingMembers.map((m) => (
                <div className="sabi-fam-coordination-row" key={m.id}>
                  <div className="who">
                    <div className="sabi-fam-avatar" style={{ background: m.color, width: 34, height: 34, fontSize: "0.78rem" }}>{m.initials}</div>
                    <div>
                      <strong>{m.name}</strong>
                      <span>{m.relationship}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`sabi-fam-coordination-check ${coManagers.has(m.id) ? "checked" : ""}`}
                    onClick={() => toggleManager(m.id)}
                  >
                    ✓
                  </button>
                </div>
              ))}
              <button type="button" className="sabi-btn-ghost" onClick={shareInvite}>
                <UserPlus2 size={14} /> Invite New Member
              </button>
            </div>
          </div>
        </div>

        <div className="sabi-fam-form-footer" style={{ border: "none", marginTop: 8 }}>
          <button type="button" className="sabi-btn-outline" onClick={() => navigate("/family/add")}>Cancel</button>
          <button type="button" className="sabi-btn-primary" onClick={handleCreate} disabled={saving}>{saving ? "Creating…" : "Create Profile"}</button>
        </div>

        {toast && <div className="sabi-toast">{toast}</div>}
      </div>
    </div>
  );
}

export default SetupDependentPage;

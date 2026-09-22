import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Mail, QrCode, Download, UserCog, Send, Pencil, Check,
  IdCard, KeyRound, UserPlus, Users,
} from "lucide-react";

import "../../styles/share.css";
import "./FamilyCircle.css";
import "../prescriptions/Prescriptions.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { addMember, addJoinedCircle } from "./familyStore";
import { RELATIONSHIPS, PERMISSION_LEVELS, EMERGENCY_ONLY_LEVEL, DEFAULT_ACCESS_BY_LEVEL, findCircleByCode } from "./data";
import { PermissionAccessPicker } from "./PermissionAccessPicker";

const ALL_LEVELS = [...PERMISSION_LEVELS, EMERGENCY_ONLY_LEVEL];
const REQUEST_FORM_EMPTY = { fullName: "", relationship: "", patientId: "" };

export function AddMemberPage() {
  const [zoom] = useZoom();
  const navigate = useNavigate();

  // "add" = add someone to MY circle. "join" = I'm joining SOMEONE ELSE'S circle.
  const [mode, setMode] = useState("add");
  const [step, setStep] = useState("permission"); // permission -> method

  const [levelId, setLevelId] = useState("care-manager");
  const [access, setAccess] = useState(DEFAULT_ACCESS_BY_LEVEL["care-manager"]);

  // "add" mode state
  const [contact, setContact] = useState("");
  const [qrGenerated, setQrGenerated] = useState(false);
  const [requestForm, setRequestForm] = useState(REQUEST_FORM_EMPTY);

  // "join" mode state
  const [inviteCode, setInviteCode] = useState("");
  const [matchedCircle, setMatchedCircle] = useState(null);

  const [toast, setToast] = useState("");

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setStep("permission");
    setLevelId("care-manager");
    setAccess(DEFAULT_ACCESS_BY_LEVEL["care-manager"]);
    setMatchedCircle(null);
    setInviteCode("");
    setQrGenerated(false);
    setContact("");
    setRequestForm(REQUEST_FORM_EMPTY);
  };

  const selectLevel = (id) => {
    setLevelId(id);
    setAccess(DEFAULT_ACCESS_BY_LEVEL[id]);
  };

  const toggleAccess = (key) => setAccess((prev) => ({ ...prev, [key]: !prev[key] }));

  const levelLabel = ALL_LEVELS.find((l) => l.id === levelId)?.label || "Care Manager";

  const updateRequestForm = (key, value) => setRequestForm((prev) => ({ ...prev, [key]: value }));

  // ---------------- "Add a Member" actions ----------------

  const handleSendPatientIdRequest = () => {
    if (!requestForm.patientId.trim() || !requestForm.relationship) {
      notify("Patient ID and relationship are required");
      return;
    }
    const member = addMember({
      name: requestForm.fullName.trim() || `Pending Patient (${requestForm.patientId.trim()})`,
      relationship: requestForm.relationship,
      sabiHealthId: requestForm.patientId.trim(),
      permission: levelId,
      access,
      isDependent: false,
      pending: true,
      status: "Awaiting Response",
    });
    navigate("/family/add/success", { state: { kind: "requested", member, permission: levelLabel } });
  };

  const handleSendInvite = () => {
    if (!contact.trim()) {
      notify("Enter an email address first");
      return;
    }
    navigate("/family/add/success", {
      state: { kind: "invite", contact: contact.trim(), permission: levelLabel },
    });
  };

  const handleGenerateQr = () => {
    setQrGenerated(true);
    notify(`QR code ready — anyone who scans it will request ${levelLabel} access`);
  };

  // ---------------- "Join a Family Circle" actions ----------------

  const handleLookupCode = () => {
    const circle = findCircleByCode(inviteCode);
    if (!circle) {
      notify("That code doesn't match any family circle — check with the admin and try again");
      setMatchedCircle(null);
      return;
    }
    setMatchedCircle(circle);
  };

  const handleConfirmJoin = () => {
    if (!matchedCircle) return;
    addJoinedCircle(matchedCircle, levelId, access);
    navigate("/family/add/success", {
      state: { kind: "joined-circle", circle: matchedCircle, permission: levelLabel },
    });
  };

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar placeholder="Search members, records..." />

        <button
          className="sabi-rxd-back"
          onClick={() => (step === "method" ? setStep("permission") : navigate("/family"))}
          style={{ marginBottom: 12 }}
        >
          <ArrowLeft size={16} /> {step === "method" ? "Back to Permission" : "Back to Circles"}
        </button>

        <div className="sabi-fam-header">
          <div>
            <h1>{mode === "add" ? "Add New Member" : "Join a Family Circle"}</h1>
            <p>
              {mode === "add"
                ? step === "permission"
                  ? "First, set the access level this member should have. You'll choose how to add them next."
                  : "Now choose how you'd like to add them — every method below uses the access level you just set."
                : step === "permission"
                  ? "Set the access level you're requesting before you join — the circle's admin can adjust it later."
                  : "Now join using a QR code or a code the family admin sent you."}
            </p>
          </div>
        </div>

        <div className="sabi-fam-field" style={{ maxWidth: 340, marginBottom: 24 }}>
          <label>What would you like to do?</label>
          <select value={mode} onChange={(e) => changeMode(e.target.value)}>
            <option value="add">Add a member to my circle</option>
            <option value="join">Join someone else's family circle</option>
          </select>
        </div>

        {step === "permission" && (
          <>
            <div className="sabi-fam-perm-required">
              <h2 style={{ margin: 0, fontSize: "1.02rem" }}>
                1. {mode === "add" ? "Select Permission Level" : "Select the Access You're Requesting"}
              </h2>
              <span className="tag">Required</span>
            </div>

            <PermissionAccessPicker levelId={levelId} access={access} onSelectLevel={selectLevel} onToggleAccess={toggleAccess} />

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20, maxWidth: 700 }}>
              <button type="button" className="sabi-btn-primary" onClick={() => setStep("method")}>
                Continue with {levelLabel} Access →
              </button>
            </div>
          </>
        )}

        {step === "method" && mode === "add" && (
          <>
            <div className="sabi-fam-access-row" style={{ background: "var(--sabi-surface)", border: "1px solid var(--sabi-border)", borderRadius: "var(--sabi-radius-md)", padding: "10px 16px", marginBottom: 20, maxWidth: 700 }}>
              <span className="label"><Check size={16} style={{ color: "var(--sabi-primary-dark)" }} /> Access level: <strong style={{ marginLeft: 4 }}>{levelLabel}</strong></span>
              <button type="button" className="sabi-btn-ghost" onClick={() => setStep("permission")}>
                <Pencil size={13} /> Change
              </button>
            </div>

            <div className="sabi-fam-add-grid">
              <div className="sabi-fam-add-option highlight">
                <div className="icon"><IdCard size={20} /></div>
                <h3>1. By Sabi Health Patient ID</h3>
                <p>They're already a Sabi Health user. We'll send them a request — they can accept or reject it from their own app.</p>
                <input
                  type="text"
                  placeholder="Patient ID, e.g. #S-2940"
                  value={requestForm.patientId}
                  onChange={(e) => updateRequestForm("patientId", e.target.value)}
                />
                <select
                  value={requestForm.relationship}
                  onChange={(e) => updateRequestForm("relationship", e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--sabi-border)", borderRadius: "var(--sabi-radius-sm)", fontSize: "0.86rem", marginTop: 8 }}
                >
                  <option value="">Select Relationship</option>
                  {RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
                </select>
                <button type="button" className="sabi-btn-primary sabi-btn-block" style={{ marginTop: 8 }} onClick={handleSendPatientIdRequest}>
                  <Send size={15} /> Send Request
                </button>
              </div>

              <div className="sabi-fam-add-option">
                <div className="icon"><Mail size={20} /></div>
                <h3>2. Via Email</h3>
                <p>Send a secure invite link to someone who already has (or can create) their own Sabi Health account.</p>
                <input
                  type="text"
                  placeholder="example@email.com"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                />
                <button type="button" className="sabi-btn-primary sabi-btn-block" onClick={handleSendInvite}>
                  <Send size={15} /> Send Invite
                </button>
              </div>

              <div className="sabi-fam-add-option">
                <div className="icon"><QrCode size={20} /></div>
                <h3>3. QR Code</h3>
                <p>Generate a QR code — they scan it to join your circle in person.</p>
                {qrGenerated ? (
                  <>
                    <div className="sabi-fam-qr-box" />
                    <button type="button" className="sabi-btn-ghost" onClick={() => notify("QR code saved to downloads")}>
                      <Download size={14} /> Save Image
                    </button>
                  </>
                ) : (
                  <button type="button" className="sabi-btn-primary sabi-btn-block" onClick={handleGenerateQr}>
                    <QrCode size={15} /> Generate QR Code
                  </button>
                )}
              </div>
            </div>

            <div className="sabi-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginTop: 24, maxWidth: 700 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--sabi-primary-light)", color: "var(--sabi-primary-dark)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <UserCog size={20} />
                </div>
                <div>
                  <strong style={{ display: "block", fontSize: "0.92rem" }}>Adding someone without a smartphone?</strong>
                  <span style={{ fontSize: "0.8rem", color: "var(--sabi-text-secondary)" }}>Set up a full dependent profile on their behalf — for children or elderly parents.</span>
                </div>
              </div>
              <button type="button" className="sabi-btn-outline" onClick={() => navigate("/family/add/dependent", { state: { permission: levelId, access } })}>
                Setup Profile
              </button>
            </div>
          </>
        )}

        {step === "method" && mode === "join" && (
          <>
            <div className="sabi-fam-access-row" style={{ background: "var(--sabi-surface)", border: "1px solid var(--sabi-border)", borderRadius: "var(--sabi-radius-md)", padding: "10px 16px", marginBottom: 20, maxWidth: 700 }}>
              <span className="label"><Check size={16} style={{ color: "var(--sabi-primary-dark)" }} /> Requesting: <strong style={{ marginLeft: 4 }}>{levelLabel}</strong></span>
              <button type="button" className="sabi-btn-ghost" onClick={() => setStep("permission")}>
                <Pencil size={13} /> Change
              </button>
            </div>

            <div className="sabi-fam-add-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="sabi-fam-add-option">
                <div className="icon"><QrCode size={20} /></div>
                <h3>Scan a QR Code</h3>
                <p>Camera-based QR scanning isn&apos;t available in this build yet — use the invite code instead.</p>
              </div>

              <div className="sabi-fam-add-option">
                <div className="icon"><KeyRound size={20} /></div>
                <h3>Enter Invite Code</h3>
                <p>Enter the code the family admin sent you directly.</p>
                <input
                  type="text"
                  placeholder="e.g. OKAFOR-7721"
                  value={inviteCode}
                  onChange={(e) => { setInviteCode(e.target.value); setMatchedCircle(null); }}
                />
                <button type="button" className="sabi-btn-primary sabi-btn-block" onClick={handleLookupCode}>
                  <KeyRound size={15} /> Look Up Code
                </button>
              </div>
            </div>

            {matchedCircle && (
              <div className="sabi-card" style={{ marginTop: 20, maxWidth: 700 }}>
                <div className="sabi-fam-dep-section-title"><Users size={16} /> Circle Found</div>
                <div className="sabi-fam-coordination-row" style={{ background: "var(--sabi-page-bg)" }}>
                  <div className="who">
                    <div className="sabi-fam-avatar" style={{ background: "var(--sabi-primary-dark)", width: 40, height: 40, fontSize: "0.85rem" }}>
                      {matchedCircle.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </div>
                    <div>
                      <strong>{matchedCircle.name}</strong>
                      <span>Owned by {matchedCircle.ownerName} · {matchedCircle.memberCount} members</span>
                    </div>
                  </div>
                </div>
                <button type="button" className="sabi-btn-primary sabi-btn-block" style={{ marginTop: 16 }} onClick={handleConfirmJoin}>
                  <UserPlus size={15} /> Request to Join as {levelLabel}
                </button>
              </div>
            )}
          </>
        )}

        {toast && <div className="sabi-toast">{toast}</div>}
      </div>
    </div>
  );
}

export default AddMemberPage;

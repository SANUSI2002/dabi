import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Link2, Copy, UserCog, Send, Pencil, Check, IdCard, KeyRound, UserPlus, Users, Loader2 } from "lucide-react";

import "../../styles/share.css";
import "./FamilyCircle.css";
import "../prescriptions/Prescriptions.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { acceptInvite, createInviteLink, inviteMember, inviteUrl, lookupInvite, requestToJoin } from "../../api/familyApi";
import { RELATIONSHIPS, DEFAULT_ACCESS_BY_LEVEL, levelLabel } from "./data";
import { PermissionAccessPicker, toggleIn } from "./PermissionAccessPicker";

const errorText = (err) => err.errors?.map((e) => e.message).join(" ") || err.message;

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  };
  return (
    <div className="sabi-fam-copy-field">
      <span>{label}</span>
      <div>
        <code>{value}</code>
        <button type="button" onClick={copy}>{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}</button>
      </div>
    </div>
  );
}

/** Add someone to my circle. */
function AddFlow({ navigate }) {
  const [step, setStep] = useState("permission"); // permission -> method
  const [levelId, setLevelId] = useState("care-manager");
  const [access, setAccess] = useState(DEFAULT_ACCESS_BY_LEVEL["care-manager"]);
  const [email, setEmail] = useState("");
  const [patientReference, setPatientReference] = useState("");
  const [relationship, setRelationship] = useState("");
  const [busy, setBusy] = useState(null); // "patientId" | "email" | "link"
  const [error, setError] = useState(null);
  const [link, setLink] = useState(null);

  const selectLevel = (id) => {
    setLevelId(id);
    setAccess(DEFAULT_ACCESS_BY_LEVEL[id]);
  };

  const run = async (kind, work) => {
    setBusy(kind);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError({ kind, text: err.status === 404 && kind === "patientId" ? "We couldn't find a Sabi Health patient with that ID." : err.status === 409 ? "There's already an open invite for this person." : errorText(err) });
    } finally {
      setBusy(null);
    }
  };

  const invite = (kind) =>
    run(kind, async () => {
      if (kind === "patientId" && (!patientReference.trim() || !relationship)) throw new Error("Enter their patient ID and choose how they're related to you.");
      if (kind === "email" && !email.trim()) throw new Error("Enter their email address.");
      const result = await inviteMember({
        ...(kind === "patientId" ? { patientReference, relationship } : { email }),
        permissionLevel: levelId,
        permissions: levelId === "emergency-only" ? [] : access,
      });
      navigate("/family/add/success", {
        state: { kind: "invite", name: kind === "patientId" ? patientReference.trim() : email.trim(), level: levelId, token: result.token },
      });
    });

  const makeLink = () => run("link", async () => setLink(await createInviteLink(levelId)));

  if (step === "permission") {
    return (
      <>
        <div className="sabi-fam-perm-required">
          <h2 style={{ margin: 0, fontSize: "1.02rem" }}>1. Choose what they can see</h2>
          <span className="tag">Required</span>
        </div>
        <PermissionAccessPicker levelId={levelId} access={access} onSelectLevel={selectLevel} onToggleAccess={(key) => setAccess((a) => toggleIn(a, key))} />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20, maxWidth: 700 }}>
          <button type="button" className="sabi-btn-primary" onClick={() => setStep("method")}>
            Continue with {levelLabel(levelId)} Access →
          </button>
        </div>
      </>
    );
  }

  const errorFor = (kind) => error?.kind === kind && <p className="sabi-form-error" role="alert">{error.text}</p>;

  return (
    <>
      <div className="sabi-fam-access-row sabi-fam-access-summary">
        <span className="label"><Check size={16} style={{ color: "var(--sabi-primary-dark)" }} /> Access level: <strong style={{ marginLeft: 4 }}>{levelLabel(levelId)}</strong></span>
        <button type="button" className="sabi-btn-ghost" onClick={() => setStep("permission")}><Pencil size={13} /> Change</button>
      </div>

      <div className="sabi-fam-add-grid">
        <div className="sabi-fam-add-option highlight">
          <div className="icon"><IdCard size={20} /></div>
          <h3>1. By Sabi Health Patient ID</h3>
          <p>For someone who already uses Sabi Health. You&apos;ll get an invite code to send them; they accept it from their own account.</p>
          <input type="text" placeholder="Patient ID, e.g. #SHM12345" value={patientReference} onChange={(e) => setPatientReference(e.target.value)} maxLength={100} />
          <select value={relationship} onChange={(e) => setRelationship(e.target.value)} className="sabi-fam-inline-select">
            <option value="">Select Relationship</option>
            {RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
          </select>
          {errorFor("patientId")}
          <button type="button" className="sabi-btn-primary sabi-btn-block" style={{ marginTop: 8 }} onClick={() => invite("patientId")} disabled={!!busy}>
            {busy === "patientId" ? <Loader2 size={15} className="sabi-spin" /> : <Send size={15} />} Create Invite
          </button>
        </div>

        <div className="sabi-fam-add-option">
          <div className="icon"><Mail size={20} /></div>
          <h3>2. By Email</h3>
          <p>Invite the person who owns this email. Only they can accept it, after signing in with that address.</p>
          <input type="email" placeholder="example@email.com" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={320} />
          {errorFor("email")}
          <button type="button" className="sabi-btn-primary sabi-btn-block" onClick={() => invite("email")} disabled={!!busy}>
            {busy === "email" ? <Loader2 size={15} className="sabi-spin" /> : <Send size={15} />} Create Invite
          </button>
        </div>

        <div className="sabi-fam-add-option">
          <div className="icon"><Link2 size={20} /></div>
          <h3>3. Share an Invite Link</h3>
          <p>Anyone signed in with the link can ask to join as {levelLabel(levelId)}. You choose exactly what they can see when you approve them.</p>
          {link ? (
            <>
              <CopyField label="Invite link" value={inviteUrl(link.token)} />
              <CopyField label="Or the code" value={link.token} />
              <small className="sabi-fam-muted">Works once · expires {new Date(link.expiresAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</small>
            </>
          ) : (
            <>
              {errorFor("link")}
              <button type="button" className="sabi-btn-primary sabi-btn-block" onClick={makeLink} disabled={!!busy}>
                {busy === "link" ? <Loader2 size={15} className="sabi-spin" /> : <Link2 size={15} />} Create Invite Link
              </button>
            </>
          )}
        </div>
      </div>

      <div className="sabi-card sabi-fam-dependent-cta">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="sabi-fam-dependent-cta-icon"><UserCog size={20} /></div>
          <div>
            <strong style={{ display: "block", fontSize: "0.92rem" }}>Adding someone without their own account?</strong>
            <span style={{ fontSize: "0.8rem", color: "var(--sabi-text-secondary)" }}>Set up a dependent profile on their behalf — for children or elderly parents.</span>
          </div>
        </div>
        <button type="button" className="sabi-btn-outline" onClick={() => navigate("/family/add/dependent")}>Setup Profile</button>
      </div>
    </>
  );
}

/** Join someone else's circle with the code they shared. */
function JoinFlow({ navigate, initialCode }) {
  const [code, setCode] = useState(initialCode);
  const [invite, setInvite] = useState(null); // lookup result
  const [levelId, setLevelId] = useState("caregiver");
  const [access, setAccess] = useState(DEFAULT_ACCESS_BY_LEVEL.caregiver);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const lookup = async () => {
    if (!/^[a-f0-9]{64}$/i.test(code.trim())) {
      setError("That doesn't look like a Sabi Health invite code. Copy the whole code or open the link you were sent.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setInvite(await lookupInvite(code));
    } catch (err) {
      setInvite(null);
      setError(err.status === 410 ? "This invite has expired. Ask them to send a new one." : err.status === 404 ? "This code isn't valid for your account. It may have been used already, or it was sent to a different email address." : errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      if (invite.kind === "DIRECT") {
        await acceptInvite(code);
        navigate("/family/add/success", { state: { kind: "joined", ownerName: invite.ownerName } });
      } else {
        await requestToJoin(code, levelId, levelId === "emergency-only" ? [] : access);
        navigate("/family/add/success", { state: { kind: "requested", ownerName: invite.ownerName, level: levelId } });
      }
    } catch (err) {
      setError(err.status === 410 ? "This invite has expired." : errorText(err));
      setBusy(false);
    }
  };

  return (
    <>
      <div className="sabi-fam-add-option sabi-fam-join-code">
        <div className="icon"><KeyRound size={20} /></div>
        <h3>Enter the invite code</h3>
        <p>Use the code or link the circle owner sent you.</p>
        <input
          type="text"
          placeholder="Paste the invite code"
          value={code}
          onChange={(e) => { setCode(e.target.value); setInvite(null); }}
          autoComplete="off"
          spellCheck={false}
        />
        {!invite && error && <p className="sabi-form-error" role="alert">{error}</p>}
        {!invite && (
          <button type="button" className="sabi-btn-primary sabi-btn-block" onClick={lookup} disabled={busy || !code.trim()}>
            {busy ? <Loader2 size={15} className="sabi-spin" /> : <KeyRound size={15} />} Look Up Code
          </button>
        )}
      </div>

      {invite && (
        <div className="sabi-card sabi-fam-join-found">
          <div className="sabi-fam-dep-section-title"><Users size={16} /> Circle Found</div>
          <div className="sabi-fam-coordination-row" style={{ background: "var(--sabi-page-bg)" }}>
            <div className="who">
              <div className="sabi-fam-avatar" style={{ background: "var(--sabi-primary-dark)", width: 40, height: 40, fontSize: "0.85rem" }}>
                {invite.ownerName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </div>
              <div>
                <strong>{invite.ownerName}&apos;s family circle</strong>
                <span>
                  {invite.kind === "DIRECT"
                    ? "You were invited personally, with access they already chose."
                    : "Choose the access you're asking for. They decide what to approve."}
                </span>
              </div>
            </div>
          </div>

          {invite.kind === "CIRCLE_LINK" && (
            <div style={{ marginTop: 16 }}>
              <PermissionAccessPicker
                levelId={levelId}
                access={access}
                onSelectLevel={(id) => { setLevelId(id); setAccess(DEFAULT_ACCESS_BY_LEVEL[id]); }}
                onToggleAccess={(key) => setAccess((a) => toggleIn(a, key))}
              />
            </div>
          )}
          {error && <p className="sabi-form-error" role="alert">{error}</p>}
          <button type="button" className="sabi-btn-primary sabi-btn-block" style={{ marginTop: 16 }} onClick={confirm} disabled={busy}>
            {busy ? <Loader2 size={15} className="sabi-spin" /> : <UserPlus size={15} />}{" "}
            {invite.kind === "DIRECT" ? "Accept Invite" : `Request to Join as ${levelLabel(levelId)}`}
          </button>
        </div>
      )}
    </>
  );
}

export function AddMemberPage() {
  const [zoom] = useZoom();
  const navigate = useNavigate();
  const location = useLocation();
  // /family/join (optionally with #<code> from an invite link) opens straight into joining.
  const joining = location.pathname.startsWith("/family/join");
  const initialCode = joining ? decodeURIComponent(location.hash.replace(/^#/, "")) : "";

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar placeholder="Search members, records..." />

        <button className="sabi-rxd-back" onClick={() => navigate("/family")} style={{ marginBottom: 12 }}>
          <ArrowLeft size={16} /> Back to Family Circle
        </button>

        <div className="sabi-fam-header">
          <div>
            <h1>{joining ? "Join a Family Circle" : "Add a Member"}</h1>
            <p>
              {joining
                ? "Someone shared their Family Circle with you. Enter their code to join."
                : "Choose what they'll be able to see, then how to invite them."}
            </p>
          </div>
        </div>

        <div className="sabi-fam-mode-switch" role="tablist" aria-label="What would you like to do?">
          <button type="button" role="tab" aria-selected={!joining} className={!joining ? "active" : ""} onClick={() => navigate("/family/add")}>
            Add to my circle
          </button>
          <button type="button" role="tab" aria-selected={joining} className={joining ? "active" : ""} onClick={() => navigate("/family/join")}>
            Join someone else&apos;s circle
          </button>
        </div>

        {joining ? <JoinFlow key={initialCode} navigate={navigate} initialCode={initialCode} /> : <AddFlow navigate={navigate} />}
      </div>
    </div>
  );
}

export default AddMemberPage;

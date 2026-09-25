import React, { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, Copy, Check, ShieldCheck, Clock, Mail } from "lucide-react";

import "../../styles/share.css";
import "./FamilyCircle.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { initialsOf, inviteUrl } from "../../api/familyApi";
import { colorFor, levelLabel } from "./data";

function CopyRow({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  return (
    <>
      <div className="sabi-fam-success-label">{label}</div>
      <div className="sabi-fam-success-id-box">
        <code>{value}</code>
        <button type="button" onClick={copy}>{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}</button>
      </div>
    </>
  );
}

const Step = ({ n, children }) => (
  <div className="sabi-fam-success-step">
    <span className="n">{n}</span>
    <span>{children}</span>
  </div>
);

/** Confirmation after inviting, creating a dependent, or joining/asking to join a circle. */
export function MemberAddedSuccessPage() {
  const [zoom] = useZoom();
  const navigate = useNavigate();
  const { state } = useLocation();

  // Reached only from the add/join flows; a reload loses the one-time code, so go back to the circle.
  if (!state?.kind) return <Navigate to="/family" replace />;
  const { kind, name, level, token, dependent, ownerName } = state;

  const pending = kind === "invite" || kind === "requested";
  const heading = {
    invite: "Invite Created",
    dependent: "Dependent Profile Created",
    joined: "You've Joined the Circle",
    requested: "Request to Join Sent",
  }[kind];
  const subheading = {
    invite: `Send ${name} this invite code. They'll get ${levelLabel(level)} access once they accept it from their own Sabi Health account.`,
    dependent: `${dependent?.name} is now part of your Family Circle. You can book hospital appointments for them and keep their health details up to date.`,
    joined: `You're now part of ${ownerName}'s family circle, with the access they chose for you.`,
    requested: `${ownerName} will review your request for ${levelLabel(level)} access. Nothing is shared with you until they approve.`,
  }[kind];

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar placeholder="Search care circle..." />

        <div className="sabi-fam-success-wrap">
          <div className="sabi-fam-success-check">{pending ? <Clock size={40} /> : <CheckCircle2 size={40} />}</div>
          <h1>{heading}</h1>
          <p>{subheading}</p>

          <div className="sabi-fam-success-layout">
            <div className="sabi-fam-success-card">
              {kind === "invite" && (
                <>
                  <div className="sabi-fam-success-id-row">
                    <div className="sabi-fam-avatar" style={{ background: "var(--sabi-primary-dark)", width: 56, height: 56 }}><Mail size={22} /></div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "1.05rem", wordBreak: "break-all" }}>{name}</div>
                      <span className="sabi-fam-relation-pill">{levelLabel(level)}</span>
                    </div>
                  </div>
                  <CopyRow label="Invite link" value={inviteUrl(token)} />
                  <CopyRow label="Invite code" value={token} />
                  <p className="sabi-fam-muted">
                    Shown only once. Sabi Health can&apos;t email it yet, so share it yourself (for example by message). It expires in 7 days.
                  </p>
                </>
              )}
              {kind === "dependent" && dependent && (
                <div className="sabi-fam-success-id-row">
                  <div className="sabi-fam-avatar" style={{ background: colorFor(dependent.id), width: 56, height: 56, fontSize: "1.2rem" }}>
                    {initialsOf(dependent.name)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>{dependent.name}</div>
                    <span className="sabi-fam-relation-pill">{dependent.careType || "Dependent"}</span>
                  </div>
                </div>
              )}
              {(kind === "joined" || kind === "requested") && (
                <div className="sabi-fam-coordination-row" style={{ background: "var(--sabi-page-bg)" }}>
                  <div className="who">
                    <div className="sabi-fam-avatar" style={{ background: "var(--sabi-primary-dark)", width: 48, height: 48, fontSize: "1rem" }}>
                      {initialsOf(ownerName)}
                    </div>
                    <div>
                      <strong>{ownerName}&apos;s family circle</strong>
                      <span>{kind === "joined" ? "Joined" : `Requested ${levelLabel(level)} access`}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="sabi-fam-success-actions">
                <button type="button" className="sabi-btn-primary" onClick={() => navigate("/family")}>Go to Family Circle</button>
                {kind === "dependent" && dependent && (
                  <button type="button" className="sabi-btn-outline" onClick={() => navigate(`/family/member/${dependent.id}`)}>View Profile</button>
                )}
              </div>
            </div>

            <div className="sabi-fam-success-steps">
              <h3>What Happens Next</h3>
              {kind === "invite" && (
                <>
                  <Step n={1}>Send {name} the link or code.</Step>
                  <Step n={2}>They sign in to Sabi Health{name.includes("@") ? " with that email address" : ""} and open <strong>Family → Join a Circle</strong>.</Step>
                  <Step n={3}>Once they accept, they appear in your circle as <strong>Active</strong>. You can change or remove their access at any time.</Step>
                </>
              )}
              {kind === "dependent" && (
                <>
                  <Step n={1}>Enroll {dependent?.name?.split(" ")[0]} with a hospital from <strong>Family → Hospital Enrollment</strong>.</Step>
                  <Step n={2}>Once enrolled, book appointments for them — they appear in your Care Calendar.</Step>
                  <Step n={3}>Keep their allergies and conditions current from their profile.</Step>
                </>
              )}
              {kind === "requested" && (
                <>
                  <Step n={1}>{ownerName} sees your request in their Family Circle.</Step>
                  <Step n={2}>They approve it and choose exactly what you can see.</Step>
                  <Step n={3}>Their circle then shows as active under <strong>Circles You&apos;ve Joined</strong>.</Step>
                </>
              )}
              {kind === "joined" && (
                <>
                  <Step n={1}>Their circle is listed under <strong>Circles You&apos;ve Joined</strong> on your Family page.</Step>
                  <Step n={2}>They can change or end your access at any time.</Step>
                </>
              )}
            </div>
          </div>

          <div className="sabi-fam-success-banner">
            <ShieldCheck size={18} />
            Access is one-way and can be withdrawn at any time. Every change is recorded.
          </div>
        </div>
      </div>
    </div>
  );
}

export default MemberAddedSuccessPage;

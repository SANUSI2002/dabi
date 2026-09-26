import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, Copy, ShieldCheck, HelpCircle, ChevronRight, Clock } from "lucide-react";

import "../../styles/share.css";
import "./FamilyCircle.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { inviteUrl } from "../../api/familyApi";

export function MemberAddedSuccessPage() {
  const [zoom] = useZoom();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [toast, setToast] = useState("");

  const kind = state?.kind || "member";
  const member = state?.member;
  const contact = state?.contact;
  const permission = state?.permission;
  const circle = state?.circle;
  // One-time invite code for a request or email invite; they open this link to accept.
  const link = state?.token ? inviteUrl(state.token) : null;

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  const copyId = () => {
    const id = member?.sabiHealthId || "";
    navigator.clipboard?.writeText(id).catch(() => {});
    notify("Sabi Health ID / Patient ID copied to clipboard");
  };

  const copyLink = () => {
    navigator.clipboard?.writeText(link).catch(() => {});
    notify("Invite link copied to clipboard");
  };

  const heading = kind === "invite"
    ? "Invite Ready to Share!"
    : kind === "dependent"
      ? "Dependent Profile Created Successfully!"
      : kind === "requested"
        ? "Request Sent!"
        : kind === "joined-circle"
          ? circle?.kind === "DIRECT" ? "You've Joined the Circle!" : "Request to Join Sent!"
          : "Member Added Successfully!";

  const subheading = kind === "invite"
    ? `Your invite for ${contact}${permission ? ` with ${permission} access` : ""} is ready. Once they accept, they'll appear in your Care Circle.`
    : kind === "requested"
      ? `We've sent a request to ${member?.name || "this patient"} with ${permission || "Care Manager"} access. They can accept or reject it from their own Sabi Health app — you'll see the status update here once they respond.`
      : kind === "joined-circle" && circle?.kind === "DIRECT"
        ? `You accepted ${circle.ownerName}'s invite. You can now see what they've chosen to share with you.`
      : kind === "joined-circle"
        ? `Your request to join ${circle?.name || "this family circle"} as a ${permission || "Care Manager"} has been sent to ${circle?.ownerName || "the circle admin"} for approval.`
        : "Your loved one is now part of your Care Circle. You can now coordinate their appointments, medications, and health records with ease and precision.";

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar placeholder="Search care circle..." />

        <div className="sabi-fam-success-wrap">
          <div className="sabi-fam-success-check">
            {kind === "requested" || kind === "joined-circle" ? <Clock size={40} /> : <CheckCircle2 size={40} />}
          </div>
          <h1>{heading}</h1>
          <p>{subheading}</p>

          <div className="sabi-fam-success-layout">
            <div className="sabi-fam-success-card">
              {kind === "joined-circle" && circle ? (
                <div className="sabi-fam-coordination-row" style={{ background: "var(--sabi-page-bg)" }}>
                  <div className="who">
                    <div className="sabi-fam-avatar" style={{ background: "var(--sabi-primary-dark)", width: 48, height: 48, fontSize: "1rem" }}>
                      {circle.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </div>
                    <div>
                      <strong>{circle.name}</strong>
                      <span>Owned by {circle.ownerName}{circle.memberCount ? ` · ${circle.memberCount} members` : ""}</span>
                    </div>
                  </div>
                </div>
              ) : member ? (
                <>
                  <div className="sabi-fam-success-id-row">
                    <div className="sabi-fam-avatar" style={{ background: member.color, width: 56, height: 56, fontSize: "1.2rem" }}>
                      {member.initials}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>{member.name}</div>
                      <span className="sabi-fam-relation-pill">{member.relationship}</span>
                    </div>
                  </div>

                  <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--sabi-text-secondary)", textTransform: "uppercase", marginBottom: 8 }}>
                    {kind === "requested" ? "Patient ID" : "Sabi Health ID"}
                  </div>
                  <div className="sabi-fam-success-id-box">
                    {member.sabiHealthId}
                    <button type="button" onClick={copyId}><Copy size={13} /> Copy</button>
                  </div>
                  {link && (
                    <>
                      <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--sabi-text-secondary)", textTransform: "uppercase", margin: "12px 0 8px" }}>
                        Invite Link
                      </div>
                      <div className="sabi-fam-success-id-box" style={{ wordBreak: "break-all" }}>
                        {link}
                        <button type="button" onClick={copyLink}><Copy size={13} /> Copy</button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <p style={{ margin: 0, color: "var(--sabi-text-secondary)" }}>
                    We&apos;ll notify you as soon as <strong>{contact}</strong> accepts your invitation.
                  </p>
                  {link && (
                    <div className="sabi-fam-success-id-box" style={{ wordBreak: "break-all", marginTop: 12 }}>
                      {link}
                      <button type="button" onClick={copyLink}><Copy size={13} /> Copy</button>
                    </div>
                  )}
                </>
              )}

              <div className="sabi-fam-success-actions">
                <button type="button" className="sabi-btn-primary" onClick={() => navigate("/family")}>
                  Go to Family Dashboard
                </button>
                {member && kind !== "requested" && (
                  <button type="button" className="sabi-btn-outline" onClick={() => navigate(`/family/member/${member.id}`)}>
                    View Profile
                  </button>
                )}
              </div>
            </div>

            <div>
              <div className="sabi-fam-success-steps">
                <h3>
                  {kind === "requested" || kind === "joined-circle" ? "What Happens Next" : "Next Steps for Account Setup"}
                </h3>
                {kind === "requested" ? (
                  <>
                    <div className="sabi-fam-success-step">
                      <span className="n">1</span>
                      <span>Send {member?.name?.split(" ")[0] || "them"} the invite link above — they open it in their own Sabi Health app.</span>
                    </div>
                    <div className="sabi-fam-success-step">
                      <span className="n">2</span>
                      <span>They can <strong>accept</strong> or <strong>reject</strong> it — nothing is shared until they accept.</span>
                    </div>
                    <div className="sabi-fam-success-step">
                      <span className="n">3</span>
                      <span>Once accepted, they'll appear in your Family &amp; Care Circle with {permission || "Care Manager"} access.</span>
                    </div>
                  </>
                ) : kind === "joined-circle" ? (
                  <>
                    <div className="sabi-fam-success-step">
                      <span className="n">1</span>
                      <span>{circle?.ownerName || "The circle admin"} gets a notification of your join request.</span>
                    </div>
                    <div className="sabi-fam-success-step">
                      <span className="n">2</span>
                      <span>They can approve or decline the <strong>{permission || "Care Manager"}</strong> access you requested.</span>
                    </div>
                    <div className="sabi-fam-success-step">
                      <span className="n">3</span>
                      <span>Once approved, you'll see their family's health data right here in your app.</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="sabi-fam-success-step">
                      <span className="n">1</span>
                      <span>{kind === "invite" ? <>Share the <strong>invite link</strong> above with the member.</> : <>Share this <strong>Sabi Health ID</strong> with the {kind === "dependent" ? "dependent or their primary caregiver" : "member"}.</>}</span>
                    </div>
                    <div className="sabi-fam-success-step">
                      <span className="n">2</span>
                      <span>They can create a Sabi Health account using this unique ID to link existing data.</span>
                    </div>
                    <div className="sabi-fam-success-step">
                      <span className="n">3</span>
                      <span>Once registered, they will automatically be linked to your <strong>Care Circle</strong> for seamless monitoring.</span>
                    </div>
                  </>
                )}
              </div>

              <div className="sabi-card" style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, cursor: "pointer" }} onClick={() => notify("Connecting to Care Support…")}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <HelpCircle size={18} style={{ color: "var(--sabi-primary-dark)" }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.86rem" }}>Need help setting up?</div>
                    <div style={{ fontSize: "0.76rem", color: "var(--sabi-text-secondary)" }}>Contact Care Support 24/7</div>
                  </div>
                </div>
                <ChevronRight size={16} />
              </div>
            </div>
          </div>

          <div className="sabi-fam-success-banner">
            <ShieldCheck size={18} />
            Your family&apos;s health data is encrypted with enterprise-grade security protocol.
          </div>
        </div>

        {toast && <div className="sabi-toast">{toast}</div>}
      </div>
    </div>
  );
}

export default MemberAddedSuccessPage;

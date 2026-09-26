import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, CalendarCheck, Baby, Clock, UserPlus, Building2, ChevronRight, X, Users2, Trash2,
  ShieldCheck, Link2, Mail, UserCheck, Calendar,
} from "lucide-react";

import "../../styles/share.css";
import "./FamilyCircle.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { LoadState } from "../hospitals/hospitalShared";
import { useApiData } from "../../api/useApiData";
import { getCircle, getUpcomingCare, initialsOf, removeDependent, removeMember } from "../../api/familyApi";
import { accessLabels, colorFor, levelLabel } from "./data";
import { getCurrentUser } from "../../utils/sabiIdentity";

const shortDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const dateTime = (iso) => new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const STATE_COPY = {
  active: { label: "Active", tone: "good" },
  invited: { label: "Invite sent", tone: "pending" },
  link: { label: "Open invite link", tone: "neutral" },
  "join-request": { label: "Wants to join", tone: "pending" },
  expired: { label: "Invite expired", tone: "bad" },
};

/* ── Confirmation modal for removing a member or dependent ─────────────────── */
function RemoveConfirmModal({ target, onCancel, onConfirm, busy, error }) {
  useEffect(() => {
    if (busy) return undefined;
    const handleKey = (e) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [busy, onCancel]);

  const dependent = target.kind === "dependent";
  const pendingInvite = !dependent && target.state !== "active";
  const title = dependent ? "Remove dependent profile?" : pendingInvite ? "Cancel this invite?" : "Remove from your circle?";
  const message = dependent
    ? `This permanently deletes ${target.name}'s dependent profile and the health details you entered. A dependent who is enrolled with a hospital or has hospital appointments can't be deleted, because those records must be kept.`
    : pendingInvite
      ? "The invite code stops working immediately."
      : `${target.name} immediately loses access to everything you shared with them. You can invite them again later.`;

  return (
    <div className="sabi-modal-overlay" role="presentation" onClick={() => !busy && onCancel()}>
      <div className="sabi-modal" role="dialog" aria-modal="true" aria-labelledby="remove-member-dialog-title" onClick={(e) => e.stopPropagation()}>
        <div className="sabi-modal-head">
          <h3 id="remove-member-dialog-title">{title}</h3>
          <button type="button" className="sabi-modal-close" aria-label="Close dialog" onClick={onCancel} disabled={busy}>
            <X size={16} />
          </button>
        </div>
        <div className="sabi-modal-body">
          <div className="sabi-fam-remove-member-info">
            <div className="sabi-fam-avatar" style={{ background: colorFor(target.id) }}>{initialsOf(target.name)}</div>
            <div>
              <strong>{target.name}</strong>
              <span>{dependent ? target.careType || "Dependent" : target.relationship || levelLabel(target.level)}</span>
            </div>
          </div>
          <p className="sabi-fam-remove-confirm-text">{message}</p>
          {error && <p className="sabi-form-error" role="alert">{error}</p>}
        </div>
        <div className="sabi-fam-remove-modal-actions">
          <button type="button" className="sabi-btn-outline" onClick={onCancel} disabled={busy}>Keep</button>
          <button type="button" className="sabi-btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? "Removing…" : pendingInvite ? "Cancel Invite" : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MemberCard({ member, onOpen, onRemove }) {
  const state = STATE_COPY[member.state] || { label: member.state, tone: "neutral" };
  const shared = accessLabels(member.permissions);
  return (
    <article className="sabi-fam-card" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen()}>
      <div className="sabi-fam-card-top">
        <div className="sabi-fam-card-id">
          <div className="sabi-fam-avatar" style={{ background: colorFor(member.id) }}>
            {member.state === "link" ? <Link2 size={18} /> : initialsOf(member.name)}
          </div>
          <div>
            <div className="sabi-fam-card-name">{member.name}</div>
            <span className="sabi-fam-relation-pill">{member.relationship || levelLabel(member.level)}</span>
          </div>
        </div>
        <span className={`sabi-status-pill ${state.tone}`}>{state.label}</span>
      </div>

      {member.state === "active" && (
        <div className="sabi-fam-card-meta-item">
          <span className="k">Can see</span>
          <span className="v">{shared.length ? shared.join(", ") : "Nothing yet"}</span>
        </div>
      )}
      {member.state === "join-request" && (
        <div className="sabi-fam-pending-note"><UserCheck size={14} /> Asked to join as {levelLabel(member.level)} — review to approve</div>
      )}
      {(member.state === "invited" || member.state === "link") && (
        <div className="sabi-fam-pending-note"><Clock size={14} /> {member.email ? "Waiting for them to accept" : "Anyone with the code can ask to join"} · expires {shortDate(member.expiresAt)}</div>
      )}
      {member.state === "expired" && <div className="sabi-fam-pending-note"><Clock size={14} /> Expired {shortDate(member.expiresAt)}</div>}

      <div className="sabi-fam-card-footer" onClick={(e) => e.stopPropagation()}>
        <button type="button" title="Open" onClick={onOpen}>
          {member.state === "join-request" ? <UserCheck size={15} /> : <ShieldCheck size={15} />}
        </button>
        <button type="button" title={member.state === "active" ? "Remove member" : "Cancel invite"} className="sabi-fam-card-footer-remove" aria-label={`Remove ${member.name}`} onClick={onRemove}>
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
}

function DependentCard({ dependent, nextEvent, onOpen, onBook, onRemove }) {
  return (
    <article className="sabi-fam-card" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen()}>
      <div className="sabi-fam-card-top">
        <div className="sabi-fam-card-id">
          <div className="sabi-fam-avatar" style={{ background: colorFor(dependent.id) }}>{initialsOf(dependent.name)}</div>
          <div>
            <div className="sabi-fam-card-name">{dependent.name}</div>
            <span className="sabi-fam-relation-pill">{dependent.careType || "Dependent"}</span>
          </div>
        </div>
      </div>
      <div className="sabi-fam-card-meta">
        <div className="sabi-fam-card-meta-item">
          <span className="k">Age</span>
          <span className="v">{dependent.age != null ? `${dependent.age} ${dependent.age === 1 ? "year" : "years"}` : "—"}</span>
        </div>
        <div className="sabi-fam-card-meta-item">
          <span className="k">Gender</span>
          <span className="v">{dependent.gender || "—"}</span>
        </div>
      </div>
      <div className="sabi-fam-card-meta-item" style={{ background: "#F4F8F7" }}>
        <span className="k">Next Appointment</span>
        <span className="v">{nextEvent ? `${dateTime(nextEvent.time)} · ${nextEvent.title}` : "Not scheduled"}</span>
      </div>
      <div className="sabi-fam-card-footer" onClick={(e) => e.stopPropagation()}>
        <button type="button" title="Profile" onClick={onOpen}><Users size={15} /></button>
        <button type="button" title="Book hospital appointment" onClick={onBook}><Calendar size={15} /></button>
        <button type="button" title="Remove dependent" className="sabi-fam-card-footer-remove" aria-label={`Remove ${dependent.name}`} onClick={onRemove}>
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
}

export function FamilyDashboardPage() {
  const [zoom] = useZoom();
  const navigate = useNavigate();
  const circle = useApiData(getCircle, []);
  const upcoming = useApiData(() => getUpcomingCare(20), []);
  const [toast, setToast] = useState("");
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState(null);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const members = circle.data?.members || [];
  const dependents = circle.data?.dependents || [];
  const joinedCircles = circle.data?.joinedCircles || [];
  // Cancelled/declined appointments are no longer on anyone's schedule.
  const events = (upcoming.data?.events || []).filter((e) => !["CANCELLED", "REJECTED", "DECLINED"].includes(e.status));

  const stats = useMemo(() => ({
    active: members.filter((m) => m.state === "active").length,
    dependents: dependents.length,
    pending: members.filter((m) => ["invited", "link", "join-request"].includes(m.state)).length,
    upcoming: events.length,
  }), [members, dependents, events]);

  const joinRequests = members.filter((m) => m.state === "join-request");
  const nextEventFor = (id) => events.find((e) => e.memberId === id);
  const selfName = getCurrentUser()?.fullName || "You";

  const confirmRemove = async () => {
    setRemoving(true);
    setRemoveError(null);
    try {
      if (removeTarget.kind === "dependent") await removeDependent(removeTarget.id);
      else await removeMember(removeTarget.id);
      const name = removeTarget.name;
      setRemoveTarget(null);
      await circle.reload();
      notify(`${name} was removed from your Family Circle`);
    } catch (err) {
      setRemoveError(err.message);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar placeholder="Search members, records, or orders..." />

        <div className="sabi-fam-header">
          <div>
            <h1>Family &amp; Care Circle</h1>
            <p>Manage the health of your loved ones and choose exactly what trusted people can see.</p>
          </div>
          <div className="sabi-fam-header-actions">
            <button type="button" className="sabi-btn-outline" onClick={() => navigate("/family/hospital-enrollment")}>
              <Building2 size={16} /> Hospital Enrollment
            </button>
            <button type="button" className="sabi-btn-outline" onClick={() => navigate("/family/join")}>
              <Users2 size={16} /> Join a Circle
            </button>
            <button type="button" className="sabi-btn-primary" onClick={() => navigate("/family/add")}>
              <UserPlus size={16} /> Add Member
            </button>
          </div>
        </div>

        <LoadState loading={circle.loading && !circle.data} error={circle.error} onRetry={circle.reload} label="Loading your care circle…">
          <div className="sabi-fam-stats">
            <div className="sabi-fam-stat">
              <div className="sabi-fam-stat-icon"><Users size={16} /></div>
              <div className="sabi-fam-stat-value">{stats.active}</div>
              <div className="sabi-fam-stat-label">Members</div>
            </div>
            <div className="sabi-fam-stat">
              <div className="sabi-fam-stat-icon"><Baby size={16} /></div>
              <div className="sabi-fam-stat-value">{stats.dependents}</div>
              <div className="sabi-fam-stat-label">Dependents</div>
            </div>
            <div className={`sabi-fam-stat ${joinRequests.length ? "alert" : ""}`}>
              <div className="sabi-fam-stat-icon"><Mail size={16} /></div>
              <div className="sabi-fam-stat-value">{stats.pending}</div>
              <div className="sabi-fam-stat-label">Pending</div>
            </div>
            <div className="sabi-fam-stat">
              <div className="sabi-fam-stat-icon"><CalendarCheck size={16} /></div>
              <div className="sabi-fam-stat-value">{upcoming.data?.hasMore ? `${stats.upcoming}+` : stats.upcoming}</div>
              <div className="sabi-fam-stat-label">Upcoming</div>
            </div>
          </div>

          {joinRequests.length > 0 && (
            <div className="sabi-fam-attention" role="status">
              <UserCheck size={18} />
              <span>
                {joinRequests.length === 1 ? `${joinRequests[0].name} wants` : `${joinRequests.length} people want`} to join your circle.
              </span>
              <button type="button" className="sabi-btn-primary" onClick={() => navigate(`/family/member/${joinRequests[0].id}`)}>Review</button>
            </div>
          )}

          <div className="sabi-fam-layout">
            <div className="sabi-fam-col">
              <section>
                <div className="sabi-fam-section-head">
                  <h2>Dependents ({dependents.length})</h2>
                </div>
                <div className="sabi-fam-grid">
                  <article className="sabi-fam-card" onClick={() => navigate("/profile")} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && navigate("/profile")}>
                    <div className="sabi-fam-card-top">
                      <div className="sabi-fam-card-id">
                        <div className="sabi-fam-avatar" style={{ background: "#2E6B5A" }}>{initialsOf(selfName)}</div>
                        <div>
                          <div className="sabi-fam-card-name">{selfName}</div>
                          <span className="sabi-fam-relation-pill">You · Circle owner</span>
                        </div>
                      </div>
                    </div>
                    <div className="sabi-fam-card-meta-item" style={{ background: "#F4F8F7" }}>
                      <span className="k">Next Appointment</span>
                      <span className="v">{nextEventFor("self") ? `${dateTime(nextEventFor("self").time)} · ${nextEventFor("self").title}` : "Not scheduled"}</span>
                    </div>
                  </article>
                  {dependents.map((d) => (
                    <DependentCard
                      key={d.id}
                      dependent={d}
                      nextEvent={nextEventFor(d.id)}
                      onOpen={() => navigate(`/family/member/${d.id}`)}
                      onBook={() => navigate("/family/hospital-enrollment")}
                      onRemove={() => { setRemoveError(null); setRemoveTarget(d); }}
                    />
                  ))}
                  <button type="button" className="sabi-fam-add-tile" onClick={() => navigate("/family/add/dependent")}>
                    <div className="icon"><UserPlus size={20} /></div>
                    Add Dependent
                  </button>
                </div>
              </section>

              <section>
                <div className="sabi-fam-section-head">
                  <h2>Care Circle Members ({members.length})</h2>
                </div>
                <p className="sabi-fam-section-note">
                  People you&apos;ve given access to your health information. Access only goes one way — their own records stay private.
                </p>
                <div className="sabi-fam-grid">
                  {members.map((m) => (
                    <MemberCard
                      key={m.id}
                      member={m}
                      onOpen={() => navigate(`/family/member/${m.id}`)}
                      onRemove={() => { setRemoveError(null); setRemoveTarget(m); }}
                    />
                  ))}
                  <button type="button" className="sabi-fam-add-tile" onClick={() => navigate("/family/add")}>
                    <div className="icon"><UserPlus size={20} /></div>
                    Invite Member
                  </button>
                </div>
              </section>
            </div>

            <div className="sabi-fam-col">
              <div className="sabi-card">
                <div className="sabi-fam-section-head">
                  <h2 style={{ fontSize: "1rem" }}>Care Calendar</h2>
                  <button type="button" className="sabi-btn-ghost" onClick={() => navigate("/family/care-calendar")}>
                    View All <ChevronRight size={14} />
                  </button>
                </div>
                {upcoming.error ? (
                  <p className="sabi-modal-empty">{upcoming.error.message}</p>
                ) : !upcoming.data ? (
                  <p className="sabi-modal-empty">Loading upcoming care…</p>
                ) : events.length === 0 ? (
                  <p className="sabi-modal-empty">No upcoming appointments across your circle.</p>
                ) : (
                  events.slice(0, 4).map((e) => (
                    <div className="sabi-fam-event" key={`${e.memberId}-${e.id}`}>
                      <strong>{e.title}</strong>
                      <span>{e.memberName} · {dateTime(e.time)}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="sabi-card">
                <div className="sabi-fam-section-head">
                  <h2 style={{ fontSize: "1rem" }}><Users2 size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />Circles You&apos;ve Joined</h2>
                </div>
                {joinedCircles.length === 0 ? (
                  <p className="sabi-modal-empty">
                    When someone shares their circle with you, it appears here.{" "}
                    <button type="button" className="sabi-btn-ghost" onClick={() => navigate("/family/join")}>Enter an invite code</button>
                  </p>
                ) : (
                  joinedCircles.map((c) => (
                    <div className="sabi-fam-coordination-row" key={c.id}>
                      <div className="who">
                        <div className="sabi-fam-avatar" style={{ background: "var(--sabi-primary-dark)", width: 34, height: 34, fontSize: "0.78rem" }}>
                          {initialsOf(c.ownerName)}
                        </div>
                        <div>
                          <strong>{c.ownerName}&apos;s circle</strong>
                          <span>
                            {c.state === "active" ? `${levelLabel(c.level)} · ${accessLabels(c.permissions).join(", ") || "no shared data yet"}` : c.state === "join-request" ? "Waiting for the owner to approve you" : c.state === "invited" ? "You've been invited — ask them for the code" : "Invite expired"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </LoadState>

        {toast && <div className="sabi-toast">{toast}</div>}

        {removeTarget && (
          <RemoveConfirmModal
            target={removeTarget}
            onCancel={() => !removing && setRemoveTarget(null)}
            onConfirm={confirmRemove}
            busy={removing}
            error={removeError}
          />
        )}
      </div>
    </div>
  );
}

export default FamilyDashboardPage;

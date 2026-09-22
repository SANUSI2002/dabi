import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, CalendarCheck, Pill, Syringe, AlertTriangle, Share2,
  UserPlus, FolderOpen, Activity, MessageSquare,
  Sparkles, CheckCircle2, Bell, ChevronRight, Clock, X, Users2, Trash2,
} from "lucide-react";

import "../../styles/share.css";
import "./FamilyCircle.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { getMembers, removeMember, getJoinedCircles } from "./familyStore";
import { CARE_ALERTS, ACTIVITY_TIMELINE, PERMISSION_LEVELS, EMERGENCY_ONLY_LEVEL } from "./data";

const ALL_LEVELS = [...PERMISSION_LEVELS, EMERGENCY_ONLY_LEVEL];

const DAYS = [
  { label: "M", date: 21 },
  { label: "T", date: 22 },
  { label: "W", date: 23, dot: true },
  { label: "T", date: 24, active: true, dot: true },
  { label: "F", date: 25 },
  { label: "S", date: 26 },
  { label: "S", date: 27 },
];

/* ── Confirmation modal for removing a family member ─────────────────── */
function RemoveConfirmModal({ member, onCancel, onConfirm, busy }) {
  // Escape key closes the modal (matching the pattern in records/components/Modal.jsx)
  useEffect(() => {
    if (busy) return undefined;
    const handleKey = (e) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [busy, onCancel]);

  // Prevent background scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div
      className="sabi-modal-overlay"
      role="presentation"
      onClick={() => !busy && onCancel()}
    >
      <div
        className="sabi-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-member-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sabi-modal-head">
          <h3 id="remove-member-dialog-title">Remove Family Member?</h3>
          <button
            type="button"
            className="sabi-modal-close"
            aria-label="Close dialog"
            onClick={onCancel}
            disabled={busy}
          >
            <X size={16} />
          </button>
        </div>

        <div className="sabi-modal-body">
          <div className="sabi-fam-remove-member-info">
            <div className="sabi-fam-avatar" style={{ background: member.color }}>
              {member.initials}
            </div>
            <div>
              <strong>{member.name}</strong>
              <span>{member.relationship}</span>
            </div>
          </div>
          <p className="sabi-fam-remove-confirm-text">
            Are you sure you want to remove <strong>{member.name}</strong> from your
            Family Circle? This action cannot be undone.
          </p>
        </div>

        <div className="sabi-fam-remove-modal-actions">
          <button
            type="button"
            className="sabi-btn-outline"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="sabi-btn-danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Removing…" : "Remove Member"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FamilyDashboardPage() {
  const [zoom] = useZoom();
  const navigate = useNavigate();
  const [members, setMembers] = useState(getMembers);
  const [joinedCircles] = useState(getJoinedCircles);
  const [toast, setToast] = useState("");
  const [alerts, setAlerts] = useState(CARE_ALERTS);
  const [removeMemberToConfirm, setRemoveMemberToConfirm] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  const cancelRequest = (member) => {
    setMembers(removeMember(member.id));
    notify(`Request to ${member.name} cancelled`);
  };

  const handleRemoveClick = (e, member) => {
    e.stopPropagation();
    setRemoveMemberToConfirm(member);
  };

  const handleRemoveCancel = () => {
    if (isRemoving) return;
    setRemoveMemberToConfirm(null);
  };

  const handleRemoveConfirm = () => {
    if (isRemoving || !removeMemberToConfirm) return;
    setIsRemoving(true);
    // familyStore.removeMember is synchronous (localStorage); update state immediately.
    const name = removeMemberToConfirm.name;
    setMembers(removeMember(removeMemberToConfirm.id));
    setRemoveMemberToConfirm(null);
    setIsRemoving(false);
    notify(`${name} has been removed from your Family Circle`);
  };

  const stats = useMemo(() => {
    const upcoming = members.filter((m) => m.nextAppointment && m.nextAppointment !== "Not scheduled").length;
    const activeMeds = members.reduce((sum, m) => sum + (m.activeMedications || 0), 0);
    const dueVax = members.reduce((sum, m) => sum + (m.dueVaccinations || 0), 0);
    const healthAlerts = members.filter((m) => m.status === "Needs Attention").length;
    return { total: members.length, upcoming, activeMeds, dueVax, healthAlerts, sharedOrders: 1 };
  }, [members]);

  const dismissAlert = (id) => setAlerts((prev) => prev.filter((a) => a.id !== id));

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar placeholder="Search members, records, or orders..." />

        <div className="sabi-fam-header">
          <div>
            <h1>Family &amp; Care Circle</h1>
            <p>Manage the health of your loved ones and trusted people in one secure place.</p>
          </div>
          <div className="sabi-fam-header-actions">
            <button type="button" className="sabi-btn-outline" onClick={() => notify("Invite link copied to clipboard")}>
                        <Share2 size={16} /> Invite to Care Circle
            </button>
            <button type="button" className="sabi-btn-outline" onClick={() => navigate("/family/hospital-enrollment")}>
              Hospital Enrollment
            </button>
            <button type="button" className="sabi-btn-primary" onClick={() => navigate("/family/add")}>
              <UserPlus size={16} /> Add Member
            </button>
          </div>
        </div>

        <div className="sabi-fam-stats">
          <div className="sabi-fam-stat">
            <div className="sabi-fam-stat-icon"><Users size={16} /></div>
            <div className="sabi-fam-stat-value">{stats.total}</div>
            <div className="sabi-fam-stat-label">Total Members</div>
          </div>
          <div className="sabi-fam-stat">
            <div className="sabi-fam-stat-icon"><CalendarCheck size={16} /></div>
            <div className="sabi-fam-stat-value">{stats.upcoming}</div>
            <div className="sabi-fam-stat-label">Upcoming</div>
          </div>
          <div className="sabi-fam-stat">
            <div className="sabi-fam-stat-icon"><Pill size={16} /></div>
            <div className="sabi-fam-stat-value">{stats.activeMeds}</div>
            <div className="sabi-fam-stat-label">Active Meds</div>
          </div>
          <div className="sabi-fam-stat">
            <div className="sabi-fam-stat-icon"><Syringe size={16} /></div>
            <div className="sabi-fam-stat-value">{stats.dueVax}</div>
            <div className="sabi-fam-stat-label">Due Vax</div>
          </div>
          <div className="sabi-fam-stat alert">
            <div className="sabi-fam-stat-icon"><AlertTriangle size={16} /></div>
            <div className="sabi-fam-stat-value">{stats.healthAlerts}</div>
            <div className="sabi-fam-stat-label">Health Alerts</div>
          </div>
          <div className="sabi-fam-stat">
            <div className="sabi-fam-stat-icon"><FolderOpen size={16} /></div>
            <div className="sabi-fam-stat-value">{stats.sharedOrders}</div>
            <div className="sabi-fam-stat-label">Shared Orders</div>
          </div>
        </div>

        <div className="sabi-fam-layout">
          <div className="sabi-fam-col">
            <section>
              <div className="sabi-fam-section-head">
                <h2>Members ({members.length})</h2>
              </div>
              <div className="sabi-fam-grid">
                {members.map((m) =>
                  m.pending ? (
                    <article key={m.id} className="sabi-fam-card sabi-fam-card-pending">
                      <div className="sabi-fam-card-top">
                        <div className="sabi-fam-card-id">
                          <div className="sabi-fam-avatar" style={{ background: m.color }}>{m.initials}</div>
                          <div>
                            <div className="sabi-fam-card-name">{m.name}</div>
                            <span className="sabi-fam-relation-pill">{m.relationship}</span>
                          </div>
                        </div>
                      </div>

                      <div className="sabi-fam-pending-note">
                        <Clock size={14} /> Awaiting response from patient
                      </div>

                      <div className="sabi-fam-card-meta-item">
                        <span className="k">Patient ID</span>
                        <span className="v">{m.sabiHealthId}</span>
                      </div>

                      <button type="button" className="sabi-btn-outline sabi-btn-block" onClick={() => cancelRequest(m)}>
                        <X size={14} /> Cancel Request
                      </button>
                    </article>
                  ) : (
                    <article
                      key={m.id}
                      className="sabi-fam-card"
                      onClick={() => navigate(`/family/member/${m.id}`)}
                    >
                      <div className="sabi-fam-card-top">
                        <div className="sabi-fam-card-id">
                          <div className="sabi-fam-avatar" style={{ background: m.color }}>{m.initials}</div>
                          <div>
                            <div className="sabi-fam-card-name">{m.name}</div>
                            <span className="sabi-fam-relation-pill">{m.relationship}</span>
                          </div>
                        </div>
                        {m.score != null && (
                          <div className="sabi-fam-card-score">
                            <strong>{m.score}</strong>
                            <span>Score</span>
                          </div>
                        )}
                      </div>

                      <div className="sabi-fam-card-meta">
                        <div className="sabi-fam-card-meta-item">
                          <span className="k">Status</span>
                          <span className="v">
                            <span className={`sabi-fam-status-dot ${m.status?.toLowerCase().replace(/\s+/g, "-")}`} />
                            {m.status}
                          </span>
                        </div>
                        <div className="sabi-fam-card-meta-item">
                          <span className="k">Age</span>
                          <span className="v">{m.age} years</span>
                        </div>
                      </div>

                      <div className="sabi-fam-card-meta-item" style={{ background: "#F4F8F7" }}>
                        <span className="k">Next Appointment</span>
                        <span className="v">{m.nextAppointment}</span>
                      </div>

                      <div className="sabi-fam-card-medbar">
                        <span>{m.activeMedications} Active Medications</span>
                        <span>Last dose: {m.lastDose}</span>
                      </div>

                      <div className="sabi-fam-card-footer" onClick={(e) => e.stopPropagation()}>
                        <button type="button" title="Profile" onClick={() => navigate(`/family/member/${m.id}`)}>
                          <Users size={15} />
                        </button>
                        <button type="button" title="Records" onClick={() => navigate("/records")}>
                          <FolderOpen size={15} />
                        </button>
                        <button type="button" title="Vitals" onClick={() => navigate("/vitals")}>
                          <Activity size={15} />
                        </button>
                        <button type="button" title="Message" onClick={() => notify(`Messaging ${m.name.split(" ")[0]}…`)}>
                          <MessageSquare size={15} />
                        </button>
                        <button
                          type="button"
                          title="Remove member"
                          className="sabi-fam-card-footer-remove"
                          aria-label={`Remove ${m.name} from Family Circle`}
                          onClick={(e) => handleRemoveClick(e, m)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </article>
                  )
                )}

                <div className="sabi-fam-add-tile" onClick={() => navigate("/family/add")}>
                  <div className="icon"><UserPlus size={20} /></div>
                  Add Member
                </div>
              </div>
            </section>

            <section>
              <div className="sabi-fam-section-head">
                <h2>Medication Monitoring</h2>
                <span className="sabi-pill">Today</span>
              </div>
              <div className="sabi-card">
                <div className="sabi-fam-monitor-slot">
                  <div className="label">Morning · 08 AM</div>
                  <div className="sabi-fam-monitor-chips">
                    {members.slice(0, 3).map((m, i) => (
                      <div key={m.id} className={`sabi-fam-chip ${i === 2 ? "missed" : "checked"}`}>
                        {i === 2 ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                        <span>
                          {m.name.split(" ")[0]}
                          <small>{i === 2 ? "MISSED" : "CHECKED"}</small>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="sabi-fam-monitor-slot" style={{ marginBottom: 0 }}>
                  <div className="label">Afternoon · 02 PM</div>
                  <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--sabi-text-secondary)" }}>
                    Next scheduled doses: {members[1]?.name.split(" ")[0]} (1), {members[2]?.name.split(" ")[0]} (1)
                  </p>
                </div>
              </div>
            </section>
          </div>

          <div className="sabi-fam-col">
            <div className="sabi-fam-ai">
              <div className="sabi-fam-ai-head">
                <div className="icon"><Sparkles size={18} /></div>
                <div>
                  <strong>Care Assistant</strong>
                  <span>Empathetic Intelligence</span>
                </div>
              </div>

              {alerts.map((alert) => (
                <div className="sabi-fam-ai-alert" key={alert.id}>
                  <p><AlertTriangle size={16} /> {alert.text}</p>
                  <div className="sabi-fam-ai-actions">
                    {alert.kind === "missed" && (
                      <button type="button" className="ghost" onClick={() => dismissAlert(alert.id)}>Ignore</button>
                    )}
                    <button
                      type="button"
                      className={`primary ${alert.kind === "missed" ? "danger" : ""}`}
                      onClick={() => {
                        dismissAlert(alert.id);
                        notify(alert.kind === "refill" ? "Refill request sent to pharmacy" : "Caregiver notified");
                      }}
                    >
                      {alert.cta}
                    </button>
                  </div>
                </div>
              ))}
              {alerts.length === 0 && (
                <div className="sabi-fam-ai-alert">
                  <p><CheckCircle2 size={16} /> You&apos;re all caught up — no active alerts.</p>
                </div>
              )}
            </div>

            <div className="sabi-card">
              <div className="sabi-fam-section-head">
                <h2 style={{ fontSize: "1rem" }}>Care Calendar</h2>
                <button type="button" className="sabi-btn-ghost" onClick={() => navigate("/family/care-calendar")}>
                  View All <ChevronRight size={14} />
                </button>
              </div>
              <div className="sabi-fam-calendar-strip">
                {DAYS.map((d) => (
                  <div key={d.date} className={`sabi-fam-calendar-day ${d.active ? "active" : ""}`}>
                    <span>{d.label}</span>
                    <strong>{d.date}</strong>
                    {d.dot && <span className="dot" />}
                  </div>
                ))}
              </div>
              <div className="label" style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--sabi-text-secondary)", textTransform: "uppercase", margin: "12px 0 8px" }}>
                Today&apos;s Events
              </div>
              <div className="sabi-fam-event">
                <strong>Cardiology Appointment</strong>
                <span>Martha · 10:00 AM</span>
              </div>
              <div className="sabi-fam-event">
                <strong>Flu Vaccination</strong>
                <span>Leo · 2:30 PM</span>
              </div>
            </div>

            {joinedCircles.length > 0 && (
              <div className="sabi-card">
                <div className="sabi-fam-section-head">
                  <h2 style={{ fontSize: "1rem" }}><Users2 size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />Circles You've Joined</h2>
                </div>
                {joinedCircles.map((c) => (
                  <div className="sabi-fam-coordination-row" key={c.id}>
                    <div className="who">
                      <div className="sabi-fam-avatar" style={{ background: "var(--sabi-primary-dark)", width: 34, height: 34, fontSize: "0.78rem" }}>
                        {c.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <strong>{c.name}</strong>
                        <span>{c.status === "pending-approval" ? "Pending admin approval" : "Joined"} · {ALL_LEVELS.find((l) => l.id === c.permission)?.label || c.permission}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="sabi-card">
              <div className="sabi-fam-section-head">
                <h2 style={{ fontSize: "1rem" }}>Activity Timeline</h2>
              </div>
              {ACTIVITY_TIMELINE.map((a) => (
                <div className="sabi-fam-timeline-item" key={a.id}>
                  <div className="dot"><Bell size={11} /></div>
                  <div>
                    <p>{a.text}</p>
                    <span>{a.meta}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {toast && <div className="sabi-toast">{toast}</div>}

        {removeMemberToConfirm && (
          <RemoveConfirmModal
            member={removeMemberToConfirm}
            onCancel={handleRemoveCancel}
            onConfirm={handleRemoveConfirm}
            busy={isRemoving}
          />
        )}
      </div>
    </div>
  );
}

export default FamilyDashboardPage;

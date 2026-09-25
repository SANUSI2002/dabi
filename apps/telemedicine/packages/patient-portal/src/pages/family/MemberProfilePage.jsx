import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Calendar, ShieldAlert, Pencil, Trash2, Building2, Stethoscope, X, Clock3, UserCheck, Loader2 } from "lucide-react";

import "../../styles/share.css";
import "./FamilyCircle.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { LoadState } from "../hospitals/hospitalShared";
import { useApiData } from "../../api/useApiData";
import {
  approveMember, getCircle, getDependent, getMember, initialsOf, removeDependent, removeMember, updateMemberPermissions,
} from "../../api/familyApi";
import { listMyEnrollments, listMyHospitalAppointments } from "../../api/sabiApi";
import { accessLabels, colorFor, levelLabel } from "./data";
import { PermissionAccessPicker, toggleIn } from "./PermissionAccessPicker";

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—");
const fmtDateTime = (iso) => new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const list = (items) => (items?.length ? items.join(", ") : "None recorded");

/** Resolves an id from the circle to either a dependent profile or a care-circle member. */
async function loadPerson(id) {
  const circle = await getCircle();
  if (circle.dependents.some((d) => d.id === id)) return { kind: "dependent", person: await getDependent(id) };
  const listed = circle.members.find((m) => m.id === id);
  // The circle listing also names people who asked to join, so prefer its name.
  if (listed) return { kind: "member", person: { ...(await getMember(id)), name: listed.name } };
  throw Object.assign(new Error("We couldn't find that person in your Family Circle."), { status: 404 });
}

function Detail({ k, v }) {
  return (
    <div className="sabi-fam-detail-card">
      <div className="k">{k}</div>
      <div className="v" style={typeof v === "string" && v.length > 18 ? { fontSize: "0.86rem" } : undefined}>{v}</div>
    </div>
  );
}

function ConfirmRemove({ title, message, confirmLabel, onCancel, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <div className="sabi-modal-overlay" onClick={() => !busy && onCancel()}>
      <div className="sabi-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sabi-modal-head">
          <h3>{title}</h3>
          <button type="button" className="sabi-modal-close" aria-label="Close" onClick={onCancel} disabled={busy}><X size={16} /></button>
        </div>
        <div className="sabi-modal-body">
          <p className="sabi-fam-remove-confirm-text">{message}</p>
          {error && <p className="sabi-form-error" role="alert">{error}</p>}
        </div>
        <div className="sabi-fam-remove-modal-actions">
          <button type="button" className="sabi-btn-outline" onClick={onCancel} disabled={busy}>Keep</button>
          <button type="button" className="sabi-btn-danger" onClick={run} disabled={busy}>{busy ? "Removing…" : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function DependentView({ dependent, navigate, initialTab }) {
  const [tab, setTab] = useState(initialTab === "appointments" || initialTab === "emergency" ? initialTab : "overview");
  const [showBookChoice, setShowBookChoice] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const care = useApiData(async () => {
    const [appointments, enrollments] = await Promise.all([listMyHospitalAppointments(), listMyEnrollments()]);
    return {
      appointments: appointments.filter((a) => a.dependentId === dependent.id).sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt)),
      enrollments: enrollments.filter((e) => e.dependentId === dependent.id),
    };
  }, [dependent.id]);
  const first = dependent.name.split(" ")[0];

  return (
    <>
      <div className="sabi-fam-profile-hero">
        <div className="sabi-fam-profile-avatar" style={{ background: colorFor(dependent.id) }}>{initialsOf(dependent.name)}</div>
        <div>
          <h1>{dependent.name}</h1>
          <div className="meta">
            <span className="sabi-fam-relation-pill">{dependent.careType || "Dependent"}</span>
            {dependent.age != null && <span>{dependent.age} {dependent.age === 1 ? "year" : "years"}</span>}
            {dependent.gender && <span>· {dependent.gender}</span>}
            {dependent.nickname && <span>· &ldquo;{dependent.nickname}&rdquo;</span>}
          </div>
        </div>
        <div className="sabi-fam-profile-hero-actions">
          <button className="sabi-btn-outline" onClick={() => navigate(`/family/member/${dependent.id}/edit`)}><Pencil size={15} /> Edit Profile</button>
          <button className="sabi-btn-primary" onClick={() => setShowBookChoice(true)}><Calendar size={15} /> Book Appointment</button>
        </div>
      </div>

      <div className="sabi-fam-tabs" role="tablist">
        {[["overview", "Overview"], ["appointments", "Hospital Care"], ["emergency", "Emergency ID"]].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`sabi-fam-tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="sabi-fam-detail-grid">
          <Detail k="Date of Birth" v={fmtDate(dependent.dateOfBirth)} />
          <Detail k="Blood Group" v={dependent.bloodGroup || "—"} />
          <Detail k="Genotype" v={dependent.genotype || "—"} />
          <Detail k="Allergies" v={list(dependent.allergies)} />
          <Detail k="Conditions" v={list(dependent.conditions)} />
          <Detail k="Immunization" v={dependent.immunizationStatus || "Not recorded"} />
          <Detail k={dependent.careType === "Elderly" ? "Mobility & Safety" : "Milestones"} v={list(dependent.milestones)} />
          <Detail k="Weight / Height" v={`${dependent.weightKg ? `${dependent.weightKg} kg` : "—"} · ${dependent.heightCm ? `${dependent.heightCm} cm` : "—"}`} />
          <Detail k="Primary Physician" v={dependent.primaryPhysician || "—"} />
          <Detail k="Insurance" v={dependent.insuranceProvider ? `${dependent.insuranceProvider}${dependent.policyNumber ? ` · ${dependent.policyNumber}` : ""}` : "—"} />
        </div>
      )}

      {tab === "appointments" && (
        <div className="sabi-card">
          <div className="sabi-fam-section-head"><h2 style={{ fontSize: "1rem" }}><Building2 size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />Hospital Care</h2></div>
          {care.error ? (
            <p className="sabi-form-error">{care.error.message}</p>
          ) : !care.data ? (
            <p className="sabi-modal-empty">Loading…</p>
          ) : (
            <>
              <div className="sabi-fam-subhead">Enrollments</div>
              {care.data.enrollments.length ? (
                <div className="sabi-fam-member-appt-list">
                  {care.data.enrollments.map((e) => (
                    <div className="sabi-fam-member-appt-row" key={e.id}>
                      <span className="dot" style={{ background: colorFor(dependent.id) }} />
                      <div><strong>{e.hospitalName}</strong><span>{e.planName}</span></div>
                      <div className="when"><span className={`sabi-status-pill ${e.status === "ACTIVE" ? "good" : e.status === "REJECTED" ? "bad" : "pending"}`}>{e.statusLabel}</span></div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="sabi-modal-empty">Not enrolled with a hospital yet.</p>
              )}
              <div className="sabi-fam-subhead">Appointments</div>
              {care.data.appointments.length ? (
                <div className="sabi-fam-member-appt-list">
                  {care.data.appointments.map((a) => (
                    <div className="sabi-fam-member-appt-row" key={a.id}>
                      <span className="dot" style={{ background: colorFor(dependent.id) }} />
                      <div><strong>{a.appointmentType}</strong><span>{a.hospitalName} · {a.statusLabel}</span></div>
                      <div className="when"><span>{fmtDateTime(a.requestedAt)}</span></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="sabi-empty-state">
                  <Clock3 size={32} />
                  <h3>No appointments yet</h3>
                  <p>Hospital appointments booked for {first} will appear here.</p>
                </div>
              )}
            </>
          )}
          <button className="sabi-btn-outline" style={{ marginTop: 12 }} onClick={() => navigate("/family/hospital-enrollment")}>Enroll or Book at a Hospital</button>
        </div>
      )}

      {tab === "emergency" && (
        <div className="sabi-card" style={{ maxWidth: 460 }}>
          <div className="sabi-fam-section-head"><h2 style={{ fontSize: "1rem" }}><ShieldAlert size={16} style={{ verticalAlign: "-3px", marginRight: 6, color: "var(--sabi-danger)" }} />Emergency ID</h2></div>
          <div className="sabi-fam-detail-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Detail k="Blood Group" v={dependent.bloodGroup || "Not recorded"} />
            <Detail k="Genotype" v={dependent.genotype || "Not recorded"} />
          </div>
          <div style={{ marginTop: 12 }}><Detail k="Allergies" v={list(dependent.allergies)} /></div>
          <div style={{ marginTop: 12 }}><Detail k="Conditions" v={list(dependent.conditions)} /></div>
          <div style={{ marginTop: 12 }}><Detail k="Date of Birth" v={fmtDate(dependent.dateOfBirth)} /></div>
        </div>
      )}

      <div className="sabi-fam-danger-row">
        <button type="button" className="sabi-btn-ghost sabi-fam-danger-link" onClick={() => setConfirming(true)}><Trash2 size={14} /> Remove dependent profile</button>
      </div>

      {showBookChoice && (
        <div className="sabi-modal-overlay" onClick={() => setShowBookChoice(false)}>
          <div className="sabi-modal sabi-fam-book-choice" role="dialog" aria-modal="true" aria-label={`Book for ${first}`} onClick={(e) => e.stopPropagation()}>
            <div className="sabi-modal-head">
              <h3>Book for {first}</h3>
              <button type="button" className="sabi-modal-close" aria-label="Close" onClick={() => setShowBookChoice(false)}><X size={16} /></button>
            </div>
            <p className="sabi-fam-book-choice-note">Where would you like to book this appointment?</p>
            <div className="sabi-fam-book-choice-grid">
              <button type="button" className="sabi-fam-book-choice-card" onClick={() => navigate("/family/hospital-enrollment")}>
                <Building2 size={26} />
                <strong>Hospital</strong>
                <span>Book at a hospital {first} is enrolled with</span>
              </button>
              <button type="button" className="sabi-fam-book-choice-card" onClick={() => navigate("/doctor", { state: { bookingForId: dependent.id, bookingForName: dependent.name, isDependent: true } })}>
                <Stethoscope size={26} />
                <strong>Doctor</strong>
                <span>Find and book a specific doctor</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {confirming && (
        <ConfirmRemove
          title="Remove dependent profile?"
          message={`This permanently deletes ${dependent.name}'s profile and the health details you entered. A dependent who is enrolled with a hospital or has hospital appointments can't be deleted, because those records must be kept.`}
          confirmLabel="Remove"
          onCancel={() => setConfirming(false)}
          onConfirm={async () => {
            await removeDependent(dependent.id);
            navigate("/family", { replace: true });
          }}
        />
      )}
    </>
  );
}

function MemberView({ member, navigate, reload }) {
  const joinRequest = member.state === "join-request";
  const editable = member.state === "active" || member.state === "invited" || joinRequest;
  const initial = joinRequest ? member.requestedPermissions : member.permissions;
  const [access, setAccess] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setAccess(joinRequest ? member.requestedPermissions : member.permissions), [member, joinRequest]);

  const dirty = JSON.stringify([...access].sort()) !== JSON.stringify([...member.permissions].sort());
  const emergencyOnly = member.level === "emergency-only";

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      if (joinRequest) await approveMember(member.id, emergencyOnly ? [] : access);
      else await updateMemberPermissions(member.id, access);
      setStatus({ tone: "good", text: joinRequest ? `${member.name} has joined your circle.` : "Access updated." });
      await reload();
    } catch (err) {
      setStatus({ tone: "bad", text: err.status === 410 ? "This request has expired." : err.message });
    } finally {
      setSaving(false);
    }
  };

  const stateText = {
    active: "Active member",
    invited: `Invite sent · waiting for them to accept (expires ${fmtDate(member.expiresAt)})`,
    link: `Open invite link · expires ${fmtDate(member.expiresAt)}`,
    "join-request": `Asked to join as ${levelLabel(member.level)}`,
    expired: `Invite expired ${fmtDate(member.expiresAt)}`,
  }[member.state] || member.state;

  return (
    <>
      <div className="sabi-fam-profile-hero">
        <div className="sabi-fam-profile-avatar" style={{ background: colorFor(member.id) }}>{initialsOf(member.name || "?")}</div>
        <div>
          <h1>{member.name || member.email || "Open invite link"}</h1>
          <div className="meta">
            <span className="sabi-fam-relation-pill">{member.relationship || levelLabel(member.level)}</span>
            <span>{stateText}</span>
            {member.email && member.name && <span>· {member.email}</span>}
          </div>
        </div>
      </div>

      {joinRequest && (
        <div className="sabi-fam-attention" role="status">
          <UserCheck size={18} />
          <span>Review what {member.name} asked for. Switch off anything you don&apos;t want to share, then approve.</span>
        </div>
      )}

      <div className="sabi-card">
        <div className="sabi-fam-section-head">
          <h2 style={{ fontSize: "1rem" }}>{joinRequest ? "Approve Access" : "What They Can See"}</h2>
          <span className="sabi-pill">{levelLabel(member.level)}</span>
        </div>
        <p className="sabi-fam-section-note">
          Access is one-way: {member.name || "this person"} sees only what you switch on here. Their own records stay private.
        </p>
        {editable ? (
          <>
            <PermissionAccessPicker showLevels={false} levelId={member.level} access={access} onToggleAccess={(key) => setAccess((a) => toggleIn(a, key))} disabled={saving} />
            {status && <p className={status.tone === "bad" ? "sabi-form-error" : "sabi-fam-success-note"} role="status">{status.text}</p>}
            <div className="sabi-fam-form-footer" style={{ border: "none" }}>
              <button type="button" className="sabi-btn-primary" onClick={save} disabled={saving || (!joinRequest && !dirty)}>
                {saving && <Loader2 size={15} className="sabi-spin" />} {joinRequest ? "Approve & Add to Circle" : "Save Access"}
              </button>
            </div>
          </>
        ) : (
          <p className="sabi-modal-empty">
            {member.state === "link" ? "You'll choose what they can see when someone uses this link and you approve them." : `Shared: ${accessLabels(member.permissions).join(", ") || "nothing"}.`}
          </p>
        )}
      </div>

      <div className="sabi-fam-danger-row">
        <button type="button" className="sabi-btn-ghost sabi-fam-danger-link" onClick={() => setConfirming(true)}>
          <Trash2 size={14} /> {member.state === "active" ? "Remove from circle" : joinRequest ? "Decline request" : "Cancel invite"}
        </button>
      </div>

      {confirming && (
        <ConfirmRemove
          title={member.state === "active" ? "Remove from your circle?" : joinRequest ? "Decline this request?" : "Cancel this invite?"}
          message={member.state === "active" ? `${member.name} immediately loses access to everything you shared.` : joinRequest ? `${member.name} won't be added and gets no access.` : "The invite code stops working immediately."}
          confirmLabel={member.state === "active" ? "Remove" : joinRequest ? "Decline" : "Cancel Invite"}
          onCancel={() => setConfirming(false)}
          onConfirm={async () => {
            await removeMember(member.id);
            navigate("/family", { replace: true });
          }}
        />
      )}
    </>
  );
}

export function MemberProfilePage() {
  const [zoom] = useZoom();
  const navigate = useNavigate();
  const { memberId } = useParams();
  const [searchParams] = useSearchParams();
  const { data, error, loading, reload } = useApiData(() => loadPerson(memberId), [memberId]);

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar placeholder="Search records, doctors..." />

        <button className="sabi-rxd-back" onClick={() => navigate("/family")} style={{ marginBottom: 12 }}>
          <ArrowLeft size={16} /> Back to Family Circle
        </button>

        <LoadState loading={loading && !data} error={error} onRetry={reload} label="Loading…">
          {data?.kind === "dependent" && <DependentView dependent={data.person} navigate={navigate} initialTab={searchParams.get("tab")} />}
          {data?.kind === "member" && <MemberView member={data.person} navigate={navigate} reload={reload} />}
        </LoadState>
      </div>
    </div>
  );
}

export default MemberProfilePage;

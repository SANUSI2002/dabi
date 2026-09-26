import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Pill, Calendar, ShieldAlert, MessageSquare, HeartPulse, Lock, Clock3,
  Building2, Stethoscope, X,
} from "lucide-react";

import "../../styles/share.css";
import "./FamilyCircle.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { getMember, updateMember } from "./familyStore";
import { PERMISSION_LEVELS, EMERGENCY_ONLY_LEVEL, DEFAULT_ACCESS_BY_LEVEL } from "./data";
import { PermissionAccessPicker } from "./PermissionAccessPicker";
import { useApiData } from "../../api/useApiData";
import { getUpcomingCare } from "../../api/familyApi";

const STATUS_LABELS = { REQUESTED: "Awaiting confirmation", CONFIRMED: "Confirmed", PENDING: "Pending", SCHEDULED: "Scheduled", CHECKED_IN: "Checked in" };

// The member, plus their upcoming care from the circle calendar.
async function loadMember(memberId) {
  const [member, upcoming] = await Promise.all([getMember(memberId), getUpcomingCare(50).catch(() => ({ events: [] }))]);
  const appointments = (upcoming.events || [])
    .filter((e) => e.memberId === memberId)
    .map((e) => {
      const when = new Date(e.time);
      return {
        id: e.id,
        doctor: e.title,
        specialty: STATUS_LABELS[e.status] || e.status,
        location: e.memberName,
        date: when.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
        time: when.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      };
    });
  return { member, appointments };
}

const ALL_LEVELS = [...PERMISSION_LEVELS, EMERGENCY_ONLY_LEVEL];

export function MemberProfilePage() {
  const [zoom] = useZoom();
  const navigate = useNavigate();
  const { memberId } = useParams();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";

  const loaded = useApiData(() => loadMember(memberId), [memberId]);
  const [member, setMember] = useState(null);
  useEffect(() => {
    if (loaded.data) setMember(loaded.data.member);
  }, [loaded.data]);
  const [tab, setTab] = useState(initialTab);
  const [toast, setToast] = useState("");
  const [showBookChoice, setShowBookChoice] = useState(false);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  if (!member) {
    return (
      <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
        <Sidebar />
        <div className="sabi-main">
          <Topbar />
          <div className="sabi-card">
            <p>{loaded.loading && !loaded.data ? "Loading…" : "We couldn't find that member."}</p>
            <button className="sabi-btn-primary" onClick={() => navigate("/family")}>Back to Family Circle</button>
          </div>
        </div>
      </div>
    );
  }

  const setPermissionLevel = async (id) => {
    try {
      setMember(await updateMember(member, { permission: id, access: DEFAULT_ACCESS_BY_LEVEL[id] }));
      notify(`Permission updated to ${ALL_LEVELS.find((l) => l.id === id)?.label}`);
    } catch (err) {
      notify(err.message);
    }
  };

  const toggleAccess = async (key) => {
    const nextAccess = { ...member.access, [key]: !member.access[key] };
    try {
      setMember(await updateMember(member, { access: nextAccess }));
    } catch (err) {
      notify(err.message);
    }
  };

  // A dependent is fully managed by the account owner, so the owner
  // always sees everything. A non-dependent (independent account)
  // decides what to share via their own access grants — only show the
  // tabs backed by something they've actually turned on.
  const fullAccess = member.isDependent !== false;
  const access = member.access || {};

  const memberAppointments = loaded.data?.appointments || [];

  const tabs = [
    { id: "overview", label: "Overview", visible: true },
    { id: "calendar", label: "Calendar", visible: fullAccess || access.appointments },
    { id: "medications", label: "Medications", visible: fullAccess || access.prescriptions },
    { id: "vitals", label: "Vitals", visible: fullAccess || access.vitals },
    { id: "permissions", label: "Permissions", visible: !member.isSelf && !member.isDependent },
    { id: "emergency", label: "Emergency ID", visible: true },
  ].filter((t) => t.visible);

  // Hospital enrollments live on the server; that page books for whoever is enrolled.
  const handleBookHospital = () => {
    setShowBookChoice(false);
    navigate("/family/hospital-enrollment");
  };

  const handleBookDoctor = () => {
    setShowBookChoice(false);
    navigate("/doctor", {
      state: { bookingForId: member.id, bookingForName: member.name, isDependent: member.isDependent },
    });
  };

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar placeholder="Search records, doctors..." />

        <button className="sabi-rxd-back" onClick={() => navigate("/family")} style={{ marginBottom: 12 }}>
          <ArrowLeft size={16} /> Back to Family Circle
        </button>

        <div className="sabi-fam-profile-hero">
          <div className="sabi-fam-profile-avatar" style={{ background: member.color }}>{member.initials}</div>
          <div>
            <h1>{member.name}</h1>
            <div className="meta">
              <span className="sabi-fam-relation-pill">{member.relationship}</span>
              {member.age != null && <span>{member.age} years</span>}
              {member.status && <span>· {member.status}</span>}
              {member.sabiHealthId && <span>· {member.sabiHealthId}</span>}
            </div>
          </div>
          <div className="sabi-fam-profile-hero-actions">
            <button className="sabi-btn-outline" onClick={() => notify(`Messaging ${member.name.split(" ")[0]}…`)}>
              <MessageSquare size={15} /> Message
            </button>
            <button className="sabi-btn-primary" onClick={() => setShowBookChoice(true)}>
              <Calendar size={15} /> Book Appointment
            </button>
          </div>
        </div>

        <div className="sabi-fam-tabs">
          {tabs.map((t) => (
            <button key={t.id} className={`sabi-fam-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {!fullAccess && (
          <p className="sabi-fam-access-note">
            <Lock size={13} /> {member.name.split(" ")[0]} manages their own account — you're only seeing what they've shared with you.
          </p>
        )}

        {tab === "overview" && (
          <div className="sabi-fam-detail-grid">
            <div className="sabi-fam-detail-card"><div className="k">Health Score</div><div className="v">{member.score ?? "—"}</div></div>
            <div className="sabi-fam-detail-card"><div className="k">Status</div><div className="v">{member.status}</div></div>
            <div className="sabi-fam-detail-card"><div className="k">Next Appointment</div><div className="v" style={{ fontSize: "0.86rem" }}>{member.nextAppointment}</div></div>
            <div className="sabi-fam-detail-card"><div className="k">Blood Group</div><div className="v">{member.bloodGroup || "—"}</div></div>
            <div className="sabi-fam-detail-card"><div className="k">Genotype</div><div className="v">{member.genotype || "—"}</div></div>
            <div className="sabi-fam-detail-card"><div className="k">Allergies</div><div className="v" style={{ fontSize: "0.86rem" }}>{member.allergies?.length ? member.allergies.join(", ") : "None recorded"}</div></div>
          </div>
        )}

        {tab === "calendar" && (
          <div className="sabi-card">
            <div className="sabi-fam-section-head"><h2 style={{ fontSize: "1rem" }}><Calendar size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />Appointment Schedule</h2></div>
            {memberAppointments.length > 0 ? (
              <div className="sabi-fam-member-appt-list">
                {memberAppointments.map((apt) => (
                  <div className="sabi-fam-member-appt-row" key={apt.id}>
                    <span className="dot" style={{ background: member.color }} />
                    <div>
                      <strong>{apt.doctor}</strong>
                      <span>{apt.specialty} · {apt.location}</span>
                    </div>
                    <div className="when">
                      <span>{apt.date}</span>
                      <span>{apt.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="sabi-empty-state">
                <Clock3 size={32} />
                <h3>No appointments scheduled</h3>
                <p>Appointments booked for {member.name.split(" ")[0]} will appear here.</p>
              </div>
            )}
            <button className="sabi-btn-outline" style={{ marginTop: 12 }} onClick={() => navigate("/appointments")}>View All Appointments</button>
          </div>
        )}

        {tab === "medications" && (
          <div className="sabi-card">
            <div className="sabi-fam-section-head"><h2 style={{ fontSize: "1rem" }}><Pill size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />Active Medications</h2></div>
            {member.activeMedications > 0 ? (
              <p style={{ margin: 0, color: "var(--sabi-text-secondary)" }}>{member.activeMedications} active medication(s) · last dose {member.lastDose}.</p>
            ) : (
              <div className="sabi-empty-state">
                <Pill size={32} />
                <h3>No active medications</h3>
                <p>Prescriptions added for {member.name.split(" ")[0]} will appear here.</p>
              </div>
            )}
            <button className="sabi-btn-outline" style={{ marginTop: 12 }} onClick={() => navigate("/prescriptions")}>View Prescriptions</button>
          </div>
        )}

        {tab === "vitals" && (
          <div className="sabi-card">
            <div className="sabi-fam-section-head"><h2 style={{ fontSize: "1rem" }}><HeartPulse size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />Vitals</h2></div>
            <div className="sabi-fam-detail-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="sabi-fam-detail-card"><div className="k">Blood Group</div><div className="v">{member.bloodGroup || "—"}</div></div>
              <div className="sabi-fam-detail-card"><div className="k">Genotype</div><div className="v">{member.genotype || "—"}</div></div>
            </div>
            <div className="sabi-fam-detail-card" style={{ marginTop: 12 }}>
              <div className="k">Allergies</div>
              <div className="v" style={{ fontSize: "0.86rem" }}>{member.allergies?.length ? member.allergies.join(", ") : "None recorded"}</div>
            </div>
            {member.isSelf ? (
              <button className="sabi-btn-outline" style={{ marginTop: 12 }} onClick={() => navigate("/vitals")}>View Full Vitals History</button>
            ) : (
              <p style={{ marginTop: 12, color: "var(--sabi-text-secondary)", fontSize: "0.84rem" }}>
                Detailed vitals tracking for {member.name.split(" ")[0]} isn&apos;t available yet — this shows what&apos;s on file so far.
              </p>
            )}
          </div>
        )}

        {tab === "permissions" && (
          <PermissionAccessPicker
            levelId={member.permission}
            access={member.access}
            onSelectLevel={setPermissionLevel}
            onToggleAccess={toggleAccess}
          />
        )}

        {tab === "emergency" && (
          <div className="sabi-card" style={{ maxWidth: 420 }}>
            <div className="sabi-fam-section-head"><h2 style={{ fontSize: "1rem" }}><ShieldAlert size={16} style={{ verticalAlign: "-3px", marginRight: 6, color: "var(--sabi-danger)" }} />Emergency ID</h2></div>
            <div className="sabi-fam-detail-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="sabi-fam-detail-card"><div className="k">Blood Group</div><div className="v">{member.bloodGroup || "—"}</div></div>
              <div className="sabi-fam-detail-card"><div className="k">Genotype</div><div className="v">{member.genotype || "—"}</div></div>
            </div>
            <div className="sabi-fam-detail-card" style={{ marginTop: 12 }}>
              <div className="k">Allergies</div>
              <div className="v" style={{ fontSize: "0.86rem" }}>{member.allergies?.length ? member.allergies.join(", ") : "None recorded"}</div>
            </div>
            <div className="sabi-fam-detail-card" style={{ marginTop: 12 }}>
              <div className="k">Sabi Health ID</div>
              <div className="v" style={{ fontSize: "0.9rem" }}>{member.sabiHealthId}</div>
            </div>
          </div>
        )}

        {showBookChoice && (
          <div className="sabi-modal-overlay" onClick={() => setShowBookChoice(false)}>
            <div className="sabi-modal sabi-fam-book-choice" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <div className="sabi-modal-head">
                <h3>Book for {member.name.split(" ")[0]}</h3>
                <button type="button" className="sabi-modal-close" aria-label="Close" onClick={() => setShowBookChoice(false)}>
                  <X size={16} />
                </button>
              </div>
              <p className="sabi-fam-book-choice-note">Where would you like to book this appointment?</p>
              <div className="sabi-fam-book-choice-grid">
                <button type="button" className="sabi-fam-book-choice-card" onClick={handleBookHospital}>
                  <Building2 size={26} />
                  <strong>Hospital</strong>
                  <span>Book at a hospital {member.name.split(" ")[0]} is enrolled with</span>
                </button>
                <button type="button" className="sabi-fam-book-choice-card" onClick={handleBookDoctor}>
                  <Stethoscope size={26} />
                  <strong>Doctor</strong>
                  <span>Find and book a specific doctor</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && <div className="sabi-toast">{toast}</div>}
      </div>
    </div>
  );
}

export default MemberProfilePage;

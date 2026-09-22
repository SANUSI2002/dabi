import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Clock3, Check, ChevronDown, ChevronRight, X, Plus, Trash2,
} from "lucide-react";

import "../../styles/share.css";
import "./Wellness.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import {
  getRequests, getEngagements, acceptProposal, cancelRequest, respondToEngagementInvite,
} from "./wellnessStore";
import { TimePicker } from "./TimePicker";
import { formatNaira } from "../../utils/currency";

const VISIBLE_SESSIONS = 5;

function ScheduleEditor({ request, onConfirm, onCancel }) {
  const [kept, setKept] = useState(() => new Set(request.proposal.sessions.map((s) => s.id)));
  const [added, setAdded] = useState([]);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("09:00");

  const toggle = (id) => {
    setKept((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSession = () => {
    if (!newDate) return;
    const d = new Date(`${newDate}T00:00:00`);
    added.push({
      id: `added-${Date.now()}`,
      date: newDate,
      dateLabel: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      appointmentDate: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      startTime: newTime,
      endTime: null,
      status: "upcoming",
      checkedInAt: null,
      checkedOutAt: null,
    });
    setAdded([...added]);
    setNewDate("");
  };

  const removeAdded = (id) => setAdded((prev) => prev.filter((s) => s.id !== id));

  const finalSessions = [
    ...request.proposal.sessions.filter((s) => kept.has(s.id)),
    ...added,
  ];

  return (
    <div className="sabi-wellness-editor">
      <p className="sabi-wellness-request-note">Uncheck any session you don&apos;t want, and add your own below.</p>
      <div className="sabi-wellness-editor-list">
        {request.proposal.sessions.map((s) => (
          <label className="sabi-wellness-editor-row" key={s.id}>
            <input type="checkbox" checked={kept.has(s.id)} onChange={() => toggle(s.id)} />
            <span className={kept.has(s.id) ? "" : "dropped"}>
              {s.dateLabel}{s.startTime ? ` · ${s.startTime}${s.endTime ? `-${s.endTime}` : ""}` : ""}
            </span>
          </label>
        ))}
        {added.map((s) => (
          <div className="sabi-wellness-editor-row added" key={s.id}>
            <Plus size={13} />
            <span>{s.dateLabel} · {s.startTime}</span>
            <button type="button" onClick={() => removeAdded(s.id)} aria-label="Remove added session"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>

      <div className="sabi-wellness-add-session-row">
        <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
        <TimePicker value={newTime} onChange={setNewTime} />
        <button type="button" className="sabi-doctor-outline" onClick={addSession}>
          <Plus size={14} /> Add
        </button>
      </div>

      <div className="sabi-wellness-request-actions">
        <button type="button" className="sabi-btn-primary" disabled={finalSessions.length === 0} onClick={() => onConfirm(finalSessions)}>
          Confirm Edited Schedule ({finalSessions.length} sessions)
        </button>
        <button type="button" className="sabi-apt-secondary-btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export function EngagementsPage() {
  const [zoom] = useZoom();
  const navigate = useNavigate();

  const [requests, setRequests] = useState(getRequests);
  const [engagements, setEngagements] = useState(getEngagements);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState("");

  const refresh = () => {
    setRequests(getRequests());
    setEngagements(getEngagements());
  };

  const notify = (msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2600);
  };

  const handleAccept = (request) => {
    acceptProposal(request.id);
    notify(`Engagement with ${request.practitionerName} confirmed`);
    refresh();
  };

  const handleConfirmEdited = (request, sessions) => {
    acceptProposal(request.id, sessions);
    setEditingId(null);
    notify(`Engagement with ${request.practitionerName} confirmed with your edits`);
    refresh();
  };

  const handleCancel = (requestId) => {
    cancelRequest(requestId);
    notify("Request cancelled");
    refresh();
  };

  const handleInviteResponse = (requestId, accepted, name) => {
    respondToEngagementInvite(requestId, accepted);
    notify(accepted ? `Accepted — waiting on a proposed schedule` : `Declined the booking for ${name}`);
    refresh();
  };

  const active = engagements.filter((e) => e.status === "active" || e.status === "awaiting_renewal");
  const past = engagements.filter((e) => e.status === "completed" || e.status === "cancelled");

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main sabi-wellness-main">
        <Topbar />

        <button className="sabi-rxd-back" onClick={() => navigate("/wellness-hub")}>
          <ArrowLeft size={18} /> Back to Wellness Hub
        </button>

        <header className="sabi-hospitals-wizard-header">
          <div>
            <h1>My Engagements</h1>
            <p>Requests, active engagements, and history across every caregiver and practitioner you&apos;ve booked.</p>
          </div>
        </header>

        {requests.length > 0 && (
          <>
            <h2 className="sabi-wellness-section-title">Requests</h2>
            <div className="sabi-wellness-request-list">
              {requests.map((r) => {
                const sessions = r.proposal?.sessions || [];
                const expanded = expandedId === r.id;
                const visibleSessions = expanded ? sessions : sessions.slice(0, VISIBLE_SESSIONS);

                return (
                  <div className="sabi-card sabi-wellness-request-card" key={r.id}>
                    <div className="sabi-wellness-request-head">
                      <div>
                        <strong>{r.practitionerName}</strong>
                        <span>For {r.bookingForName} · {r.durationDays} days · {formatNaira(r.totalCost)}</span>
                      </div>
                      {r.status === "awaiting_member_acceptance" && (
                        <span className="sabi-wellness-status-pill pending"><Clock3 size={13} /> Awaiting {r.bookingForName.split(" ")[0]}&apos;s Acceptance</span>
                      )}
                      {r.status === "declined_by_member" && (
                        <span className="sabi-wellness-status-pill declined"><X size={13} /> Declined</span>
                      )}
                      {r.status === "awaiting_proposal" && (
                        <span className="sabi-wellness-status-pill pending"><Clock3 size={13} /> Awaiting Proposal</span>
                      )}
                      {r.status === "awaiting_client_review" && (
                        <span className="sabi-wellness-status-pill review">
                          <Clock3 size={13} /> {r.bookedForIndependent ? `${r.bookingForName.split(" ")[0]} Reviewing` : "Review Schedule"}
                        </span>
                      )}
                    </div>

                    {r.status === "awaiting_member_acceptance" && (
                      <>
                        <p className="sabi-wellness-request-note">
                          {r.bookingForName} has their own Sabi Health account, so they need to accept being booked with
                          {" "}{r.practitionerName} before a schedule is requested. (Simulating {r.bookingForName.split(" ")[0]}&apos;s response below.)
                        </p>
                        <div className="sabi-wellness-request-actions">
                          <button type="button" className="sabi-btn-primary" onClick={() => handleInviteResponse(r.id, true, r.bookingForName)}>
                            <Check size={15} /> Accept as {r.bookingForName.split(" ")[0]}
                          </button>
                          <button type="button" className="sabi-apt-secondary-btn" onClick={() => handleInviteResponse(r.id, false, r.bookingForName)}>
                            <X size={14} /> Decline
                          </button>
                        </div>
                      </>
                    )}

                    {r.status === "declined_by_member" && (
                      <div className="sabi-wellness-request-actions">
                        <button type="button" className="sabi-apt-secondary-btn" onClick={() => handleCancel(r.id)}>
                          Remove
                        </button>
                      </div>
                    )}

                    {r.status === "awaiting_proposal" && (
                      <p className="sabi-wellness-request-note">
                        Waiting for {r.practitionerName} to propose a schedule for this engagement.
                      </p>
                    )}

                    {r.status === "awaiting_client_review" && r.bookedForIndependent && (
                      <p className="sabi-wellness-request-note">
                        {r.practitionerName} sent {r.bookingForName} a schedule to review. {r.bookingForName.split(" ")[0]}{" "}
                        reviews and confirms it themself — you&apos;ll see this move to your active engagements once they do.
                      </p>
                    )}

                    {r.status === "awaiting_client_review" && !r.bookedForIndependent && editingId !== r.id && (
                      <>
                        <p className="sabi-wellness-request-note">
                          {r.practitionerName} proposed the following schedule ({sessions.length} sessions):
                        </p>
                        <div className="sabi-wellness-session-simple-list">
                          {visibleSessions.map((s) => (
                            <div className="sabi-wellness-session-simple-row" key={s.id}>
                              {s.dateLabel}{s.startTime ? ` · ${s.startTime}${s.endTime ? `-${s.endTime}` : ""}` : ""}
                            </div>
                          ))}
                        </div>
                        {sessions.length > VISIBLE_SESSIONS && (
                          <button type="button" className="sabi-wellness-view-more-btn" onClick={() => setExpandedId(expanded ? null : r.id)}>
                            {expanded ? "View Less" : `View More (${sessions.length - VISIBLE_SESSIONS} more)`}
                            <ChevronDown size={14} style={{ transform: expanded ? "rotate(180deg)" : "none" }} />
                          </button>
                        )}

                        <div className="sabi-wellness-request-actions">
                          <button type="button" className="sabi-btn-primary" onClick={() => handleAccept(r)}>
                            <Check size={15} /> Accept Schedule
                          </button>
                          <button type="button" className="sabi-apt-secondary-btn" onClick={() => setEditingId(r.id)}>
                            Edit Schedule
                          </button>
                        </div>
                      </>
                    )}

                    {r.status === "awaiting_client_review" && !r.bookedForIndependent && editingId === r.id && (
                      <ScheduleEditor
                        request={r}
                        onConfirm={(sessions) => handleConfirmEdited(r, sessions)}
                        onCancel={() => setEditingId(null)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <h2 className="sabi-wellness-section-title">Active Engagements</h2>
        {active.length === 0 ? (
          <div className="sabi-card sabi-empty-state">
            <Clock3 size={32} />
            <h3>No active engagements</h3>
            <p>Book a caregiver or practitioner from the Wellness Hub to get started.</p>
          </div>
        ) : (
          <div className="sabi-wellness-engagement-list">
            {active.map((e) => (
              <button type="button" className="sabi-card sabi-wellness-engagement-card" key={e.id} onClick={() => navigate(`/wellness-hub/engagements/${e.id}`)}>
                <div>
                  <strong>{e.practitionerName}</strong>
                  <span>For {e.bookingForName} · {e.durationDays} days</span>
                </div>
                <span className="sabi-wellness-status-pill active"><Check size={13} /> Active</span>
                <ChevronRight size={16} className="chevron" />
              </button>
            ))}
          </div>
        )}

        {past.length > 0 && (
          <>
            <h2 className="sabi-wellness-section-title">Past Engagements</h2>
            <div className="sabi-wellness-engagement-list">
              {past.map((e) => (
                <button type="button" className="sabi-card sabi-wellness-engagement-card muted" key={e.id} onClick={() => navigate(`/wellness-hub/engagements/${e.id}`)}>
                  <div>
                    <strong>{e.practitionerName}</strong>
                    <span>For {e.bookingForName} · {e.durationDays} days</span>
                  </div>
                  <span className="sabi-wellness-status-pill">{e.status === "cancelled" ? "Cancelled" : "Completed"}</span>
                  <ChevronRight size={16} className="chevron" />
                </button>
              ))}
            </div>
          </>
        )}

        {toast && <div className="sabi-toast">{toast}</div>}
      </div>
    </div>
  );
}

export default EngagementsPage;

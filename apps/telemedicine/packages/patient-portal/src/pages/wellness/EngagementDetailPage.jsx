import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, LogIn, LogOut, Clock3, CheckCircle2, MapPin, X,
} from "lucide-react";

import "../../styles/share.css";
import "./Wellness.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { getEngagement, checkInSession, checkOutSession, cancelEngagement } from "./wellnessStore";
import { formatNaira } from "../../utils/currency";

export function EngagementDetailPage() {
  const [zoom] = useZoom();
  const { engagementId } = useParams();
  const navigate = useNavigate();
  const [engagement, setEngagement] = useState(() => getEngagement(engagementId));
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  if (!engagement) {
    return (
      <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
        <Sidebar />
        <div className="sabi-main">
          <Topbar />
          <div className="sabi-card">
            <p>We couldn&apos;t find that engagement.</p>
            <button className="sabi-btn-primary" onClick={() => navigate("/wellness-hub/engagements")}>Back to My Engagements</button>
          </div>
        </div>
      </div>
    );
  }

  const refresh = () => setEngagement(getEngagement(engagementId));
  const isPhysical = engagement.visitType === "physical";

  const completedCount = engagement.sessions.filter((s) => s.status === "completed").length;
  const progressPct = Math.round((completedCount / engagement.sessions.length) * 100) || 0;

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main sabi-wellness-main">
        <Topbar />

        <button className="sabi-rxd-back" onClick={() => navigate("/wellness-hub/engagements")}>
          <ArrowLeft size={18} /> Back to My Engagements
        </button>

        <header className="sabi-hospitals-wizard-header">
          <div>
            <h1>{engagement.practitionerName}</h1>
            <p>For {engagement.bookingForName} · {engagement.durationDays}-day engagement · {formatNaira(engagement.totalCost)} paid</p>
          </div>
          {engagement.status === "active" && (
            <button type="button" className="sabi-apt-secondary-btn" onClick={() => setShowCancel(true)}>
              Cancel Engagement
            </button>
          )}
        </header>

        <div className="sabi-card sabi-wellness-progress-card">
          <div className="sabi-wellness-progress-head">
            <strong>{completedCount} of {engagement.sessions.length} sessions completed</strong>
            <span>{progressPct}%</span>
          </div>
          <div className="sabi-wellness-progress-bar">
            <div className="sabi-wellness-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          {isPhysical && engagement.address && (
            <p className="sabi-wellness-languages" style={{ marginTop: 10 }}>
              <MapPin size={13} /> {engagement.address.address}
            </p>
          )}
        </div>

        <h2 className="sabi-wellness-section-title">Schedule</h2>
        <div className="sabi-wellness-session-list">
          {engagement.sessions.map((s) => (
            <div className="sabi-fam-member-appt-row sabi-wellness-session-row" key={s.id}>
              <span className={`dot ${s.status}`} />
              <div>
                <strong>{s.dateLabel}</strong>
                <span>{s.startTime ? `${s.startTime} - ${s.endTime}` : "Virtual session"}</span>
                {s.checkedInAt && (
                  <span className="sabi-wellness-checkin-times">
                    Checked in {new Date(s.checkedInAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    {s.checkedOutAt && ` · out ${new Date(s.checkedOutAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
                  </span>
                )}
              </div>
              <div className="sabi-wellness-session-actions">
                {s.status === "completed" ? (
                  <span className="sabi-wellness-status-pill active"><CheckCircle2 size={13} /> Completed</span>
                ) : isPhysical ? (
                  !s.checkedInAt ? (
                    <button type="button" className="sabi-wellness-demo-btn" onClick={() => { checkInSession(engagement.id, s.id); refresh(); }}>
                      <LogIn size={13} /> Simulate Check-In
                    </button>
                  ) : (
                    <button type="button" className="sabi-wellness-demo-btn" onClick={() => { checkOutSession(engagement.id, s.id); refresh(); }}>
                      <LogOut size={13} /> Simulate Check-Out
                    </button>
                  )
                ) : (
                  <span className="sabi-wellness-status-pill pending"><Clock3 size={13} /> Upcoming</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <h2 className="sabi-wellness-section-title">Activity</h2>
        <div className="sabi-card">
          {engagement.activity.length === 0 ? (
            <p className="sabi-modal-empty">No activity yet.</p>
          ) : (
            <div className="sabi-wellness-activity-list">
              {engagement.activity.map((a) => (
                <div className="sabi-wellness-activity-row" key={a.id}>
                  <span>{a.description}</span>
                  <small>{new Date(a.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</small>
                </div>
              ))}
            </div>
          )}
        </div>

        {showCancel && (
          <div className="sabi-modal-overlay" onClick={() => setShowCancel(false)}>
            <div className="sabi-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <div className="sabi-modal-head">
                <h3>Cancel this engagement?</h3>
                <button type="button" className="sabi-modal-close" onClick={() => setShowCancel(false)} aria-label="Close"><X size={16} /></button>
              </div>
              <p className="sabi-confirm-message">
                This ends the engagement with {engagement.practitionerName} early. Remaining, undelivered sessions won&apos;t take place.
              </p>
              <textarea
                className="sabi-resched-reason"
                rows={2}
                placeholder="Reason (optional)"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
              <div className="sabi-modal-actions">
                <button
                  type="button"
                  className="sabi-btn-primary"
                  onClick={() => { cancelEngagement(engagement.id, cancelReason); setShowCancel(false); refresh(); }}
                >
                  Confirm Cancellation
                </button>
                <button type="button" className="sabi-btn-outline" onClick={() => setShowCancel(false)}>Keep Engagement</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EngagementDetailPage;

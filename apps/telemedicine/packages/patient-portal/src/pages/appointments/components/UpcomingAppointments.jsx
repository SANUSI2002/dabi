import React from "react";
import { Card } from "design-system";
import { Video, Clock3, LogIn, Check, X as XIcon, Sparkles, MapPin } from "lucide-react";
import { SectionTitle } from "../../dashboard/share";
import { EmptyState, StatusBadge } from "../../../../../shared-portal/design-system/ui.jsx";

// The UI status (see byDoctor in api/doctorsApi.js) mapped onto the shared badge, worded for patients.
const BADGE = {
  "pending-review": ["REQUESTED", "Pending review"],
  active: ["CONFIRMED", "Confirmed"],
  completed: ["COMPLETED", "Completed"],
  missed: ["EXPIRED", "Missed"],
  cancelled: ["CANCELLED", "Cancelled"],
};
const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const day = (iso) => new Date(iso).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });

export function UpcomingAppointments({
  appointments,
  title,
  onViewAll,
  onReschedule,
  onJoin,
  onCheckIn,
  onViewDetails,
  onViewWellness,
  onCancel,
  onRespondToRequest,
}) {
  const heading = title === "Today" ? "Today's Appointments" : title === "All" ? "All Appointments" : `${title} Appointments`;
  return (
    <Card>
      <SectionTitle action="View All" onAction={onViewAll}>{heading}</SectionTitle>
      {appointments.length === 0 && <EmptyState title={`No ${title.toLowerCase()} appointments yet.`} />}
      <div className="sabi-apt-list">
        {appointments.map((apt) => {
          const pendingReview = apt.status === "pending-review";
          const awaitingAcceptance = apt.status === "awaiting-acceptance";
          const declined = apt.status === "declined-by-member";
          const badge = BADGE[apt.status];
          return (
            <article className={`sabi-apt-item${pendingReview || awaitingAcceptance ? " sabi-apt-item-pending" : ""}${declined ? " sabi-apt-item-declined" : ""}`} key={apt.id} aria-label={`${apt.doctor}, ${apt.date} at ${apt.time}`}>
              <div className="sabi-apt-item-top">
                <div className="sabi-apt-avatar" style={{ background: apt.color }} aria-hidden="true">{apt.initials}</div>
                <div className="sabi-apt-item-body">
                  <div className="sabi-apt-item-name">{apt.doctor}</div>
                  <div className="sabi-apt-item-sub">{apt.specialty}</div>
                  <div className="sabi-apt-item-location">{apt.location}{apt.bookedFor ? ` · for ${apt.bookedFor}` : ""}</div>
                </div>
                <div className="sabi-apt-item-when">
                  <div className="sabi-apt-item-date">{apt.date}</div>
                  <div className="sabi-apt-item-time">{apt.time}</div>
                  {badge && <StatusBadge status={badge[0]} labels={{ [badge[0]]: badge[1] }} />}
                </div>
              </div>

              {pendingReview && <div className="sabi-apt-pending-note"><Clock3 size={14} aria-hidden="true" /> {apt.rescheduleNote || "Pending Review — requested, not yet confirmed"}</div>}
              {awaitingAcceptance && <div className="sabi-apt-pending-note"><Clock3 size={14} aria-hidden="true" /> Reservation made for {apt.bookedFor} — simulating {apt.bookedFor.split(" ")[0]}'s response below</div>}
              {declined && <div className="sabi-apt-declined-note"><XIcon size={14} aria-hidden="true" /> {apt.bookedFor?.split(" ")[0]} rejected this consultation</div>}
              {apt.declineNote && <div className="sabi-apt-declined-note"><XIcon size={14} aria-hidden="true" /> {apt.declineNote}</div>}
              {apt.status === "active" && apt.virtual && !apt.joinOpen && apt.joinOpensAt && <div className="sabi-apt-info-note"><Video size={14} aria-hidden="true" /> Your private video room opens at {clock(apt.joinOpensAt)} on {day(apt.joinOpensAt)}.</div>}
              {apt.status === "active" && !apt.virtual && apt.address && <div className="sabi-apt-info-note"><MapPin size={14} aria-hidden="true" /> {apt.address}</div>}

              <div className="sabi-apt-item-actions">
                {apt.wellnessEngagementId ? (
                  <button type="button" className="sabi-apt-checkin-btn" onClick={() => onViewWellness(apt)}><Sparkles size={15} aria-hidden="true" /> View in Wellness Hub</button>
                ) : apt.status === "active" ? (
                  apt.virtual ? (
                    <>
                      <button type="button" className="sabi-apt-join-btn" onClick={() => onJoin(apt)}><Video size={15} aria-hidden="true" /> Join Consultation</button>
                      <button type="button" className="sabi-apt-secondary-btn" onClick={() => onReschedule(apt)}>Reschedule</button>
                    </>
                  ) : apt.hospitalId ? (
                    <>
                      <button type="button" className="sabi-apt-checkin-btn" onClick={() => onCheckIn(apt)}><LogIn size={15} aria-hidden="true" /> Check-in</button>
                      <button type="button" className="sabi-apt-secondary-btn" onClick={() => onReschedule(apt)}>Reschedule</button>
                    </>
                  ) : (
                    <>
                      <span className="sabi-apt-housecall-note">{apt.visitNote || "Doctor visits you — no check-in needed"}</span>
                      <button type="button" className="sabi-apt-secondary-btn" onClick={() => onReschedule(apt)}>Reschedule</button>
                    </>
                  )
                ) : awaitingAcceptance ? (
                  <>
                    <button type="button" className="sabi-apt-accept-btn" onClick={() => onRespondToRequest(apt.id, true)}><Check size={15} aria-hidden="true" /> Accept</button>
                    <button type="button" className="sabi-apt-decline-btn" onClick={() => onRespondToRequest(apt.id, false)}><XIcon size={15} aria-hidden="true" /> Decline</button>
                  </>
                ) : declined ? (
                  <button type="button" className="sabi-apt-secondary-btn" onClick={() => onCancel(apt.id)}>Remove</button>
                ) : pendingReview ? (
                  <>
                    <button type="button" className="sabi-apt-view-btn" onClick={() => onViewDetails(apt)}>View Request</button>
                    <button type="button" className="sabi-apt-secondary-btn sabi-apt-cancel-btn" onClick={() => onCancel(apt.id)}>Cancel Request</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="sabi-apt-view-btn" onClick={() => onViewDetails(apt)}>View Details</button>
                    {apt.canChange !== false && <button type="button" className="sabi-apt-secondary-btn sabi-apt-cancel-btn" onClick={() => onCancel(apt.id)}>Cancel</button>}
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </Card>
  );
}

export default UpcomingAppointments;

import React from "react";
import { Card } from "design-system";
import { Video, Clock3, LogIn, X as XIcon, Sparkles, MapPin } from "lucide-react";
import { SectionTitle } from "../../dashboard/share";
import { EmptyState, StatusBadge } from "../../../../../shared-portal/design-system/ui.jsx";

// The UI status (see byDoctor in api/doctorsApi.js) mapped onto the shared badge, worded for patients.
const BADGE = {
  "pending-review": ["REQUESTED", "Awaiting confirmation"],
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
}) {
  const heading = title === "All" ? "All appointments" : title === "Upcoming" ? "Upcoming appointments" : `${title} appointments`;
  return (
    <Card>
      <SectionTitle action={title === "All" ? undefined : "View all"} onAction={onViewAll}>{heading}</SectionTitle>
      {appointments.length === 0 && <EmptyState title={`No ${title === "All" ? "" : `${title.toLowerCase()} `}appointments`}>{title === "Upcoming" ? "Book a consultation and it will appear here." : "Appointments in this view will appear here."}</EmptyState>}
      <div className="sabi-apt-list">
        {appointments.map((apt) => {
          const [badgeStatus, badgeLabel] = BADGE[apt.status] || [apt.apiStatus, apt.statusLabel];
          const pendingReview = apt.status === "pending-review";
          return (
            <article className={`sabi-apt-item${pendingReview ? " sabi-apt-item-pending" : ""}`} key={apt.id} aria-label={`${apt.typeLabel || "Consultation"} with ${apt.doctor}, ${apt.date} at ${apt.time}`}>
              <div className="sabi-apt-item-top">
                <div className="sabi-apt-avatar" style={{ background: apt.color }} aria-hidden="true">{apt.initials}</div>
                <div className="sabi-apt-item-body">
                  <div className="sabi-apt-item-name">{apt.doctor}</div>
                  {apt.specialty && <div className="sabi-apt-item-sub">{apt.specialty}</div>}
                  <div className="sabi-apt-item-location">{apt.location}{apt.bookedFor ? ` · for ${apt.bookedFor}` : ""}</div>
                </div>
                <div className="sabi-apt-item-when">
                  <div className="sabi-apt-item-date">{apt.date}</div>
                  <div className="sabi-apt-item-time">{apt.time}</div>
                  <StatusBadge status={badgeStatus} labels={{ [badgeStatus]: badgeLabel }} />
                </div>
              </div>

              {pendingReview && <div className="sabi-apt-pending-note"><Clock3 size={14} aria-hidden="true" /> Waiting for {apt.doctor} to confirm. You'll be notified when they respond.</div>}
              {apt.declineNote && <div className="sabi-apt-declined-note"><XIcon size={14} aria-hidden="true" /> {apt.declineNote}</div>}
              {apt.status === "active" && apt.virtual && !apt.joinOpen && <div className="sabi-apt-info-note"><Video size={14} aria-hidden="true" /> Your private video room opens at {clock(apt.joinOpensAt)} on {day(apt.joinOpensAt)}.</div>}
              {apt.status === "active" && !apt.virtual && apt.address && <div className="sabi-apt-info-note"><MapPin size={14} aria-hidden="true" /> {apt.address}</div>}

              <div className="sabi-apt-item-actions">
                {apt.wellnessEngagementId ? (
                  <button type="button" className="sabi-apt-checkin-btn" onClick={() => onViewWellness(apt)}><Sparkles size={15} aria-hidden="true" /> View in Wellness Hub</button>
                ) : apt.status === "active" ? (
                  <>
                    {apt.virtual && apt.joinOpen && <button type="button" className="sabi-apt-join-btn" onClick={() => onJoin(apt)}><Video size={15} aria-hidden="true" /> Join consultation</button>}
                    {!apt.virtual && apt.hospitalId && <button type="button" className="sabi-apt-checkin-btn" onClick={() => onCheckIn(apt)}><LogIn size={15} aria-hidden="true" /> Check in</button>}
                    <button type="button" className="sabi-apt-view-btn" onClick={() => onViewDetails(apt)}>View details</button>
                    {apt.canChange && <button type="button" className="sabi-apt-secondary-btn" onClick={() => onReschedule(apt)}>Reschedule</button>}
                    {apt.canChange && <button type="button" className="sabi-apt-secondary-btn sabi-apt-cancel-btn" onClick={() => onCancel(apt.id)}>Cancel</button>}
                  </>
                ) : pendingReview ? (
                  <>
                    <button type="button" className="sabi-apt-view-btn" onClick={() => onViewDetails(apt)}>View request</button>
                    <button type="button" className="sabi-apt-secondary-btn sabi-apt-cancel-btn" onClick={() => onCancel(apt.id)}>Cancel request</button>
                  </>
                ) : (
                  <button type="button" className="sabi-apt-view-btn" onClick={() => onViewDetails(apt)}>View details</button>
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

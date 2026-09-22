import React from "react";
import { Card } from "design-system";
import { Video, Clock3, LogIn, Check, X as XIcon, Sparkles } from "lucide-react";
import { SectionTitle } from "../../dashboard/share";

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
  return (
    <Card>
<SectionTitle 
      action="View All"
      onAction={onViewAll}
    >
      {title === "Today"
          ? "Today's Appointments"
          : title === "All"
          ? "All Appointments"
          : `${title} Appointments`
      }
</SectionTitle>
{appointments.length === 0 && (
  <p className="sabi-modal-empty">
    No {title.toLowerCase()} appointments yet.
  </p>
)}
      <div className="sabi-apt-list">
        {appointments.map((apt) => {
          const pendingReview = apt.status === "pending-review";
          const awaitingAcceptance = apt.status === "awaiting-acceptance";
          const declined = apt.status === "declined-by-member";
          return (
            <div className={`sabi-apt-item${pendingReview || awaitingAcceptance ? " sabi-apt-item-pending" : ""}${declined ? " sabi-apt-item-declined" : ""}`} key={apt.id}>
              <div className="sabi-apt-item-top">
                <div className="sabi-apt-avatar" style={{ background: apt.color }}>
                  {apt.initials}
                </div>
                <div className="sabi-apt-item-body">
                  <div className="sabi-apt-item-name">{apt.doctor}</div>
                  <div className="sabi-apt-item-sub">{apt.specialty}</div>
                  <div className="sabi-apt-item-location">{apt.location}</div>
                </div>
                <div className="sabi-apt-item-when">
                  <div className="sabi-apt-item-date">{apt.date}</div>
                  <div className="sabi-apt-item-time">{apt.time}</div>
                </div>
              </div>

              {pendingReview && (
                <div className="sabi-apt-pending-note">
                  <Clock3 size={14} /> {apt.rescheduleNote || "Pending Review — requested, not yet confirmed"}
                </div>
              )}

              {awaitingAcceptance && (
                <div className="sabi-apt-pending-note">
                  <Clock3 size={14} /> Reservation made for {apt.bookedFor} — simulating {apt.bookedFor.split(" ")[0]}'s response below
                </div>
              )}

              {declined && (
                <div className="sabi-apt-declined-note">
                  <XIcon size={14} /> {apt.bookedFor?.split(" ")[0]} rejected this consultation
                </div>
              )}

              <div className="sabi-apt-item-actions">
                {apt.wellnessEngagementId ? (
                  <button type="button" className="sabi-apt-checkin-btn" onClick={() => onViewWellness(apt)}>
                    <Sparkles size={15} />
                    View in Wellness Hub
                  </button>
                ) : apt.status === "active" ? (
                  apt.virtual ? (
                    <>
                      <button type="button" className="sabi-apt-join-btn" onClick={() => onJoin(apt)}>
                        <Video size={15} />
                        Join Consultation
                      </button>
                      <button type="button" className="sabi-apt-secondary-btn" onClick={() => onReschedule(apt)}>
                        Reschedule
                      </button>
                    </>
                  ) : apt.hospitalId ? (
                    <>
                      <button type="button" className="sabi-apt-checkin-btn" onClick={() => onCheckIn(apt)}>
                        <LogIn size={15} />
                        Check-in
                      </button>
                      <button type="button" className="sabi-apt-secondary-btn" onClick={() => onReschedule(apt)}>
                        Reschedule
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="sabi-apt-housecall-note">Doctor visits you — no check-in needed</span>
                      <button type="button" className="sabi-apt-secondary-btn" onClick={() => onReschedule(apt)}>
                        Reschedule
                      </button>
                    </>
                  )
                ) : awaitingAcceptance ? (
                  <>
                    <button type="button" className="sabi-apt-accept-btn" onClick={() => onRespondToRequest(apt.id, true)}>
                      <Check size={15} /> Accept
                    </button>
                    <button type="button" className="sabi-apt-decline-btn" onClick={() => onRespondToRequest(apt.id, false)}>
                      <XIcon size={15} /> Decline
                    </button>
                  </>
                ) : declined ? (
                  <button type="button" className="sabi-apt-secondary-btn" onClick={() => onCancel(apt.id)}>
                    Remove
                  </button>
                ) : pendingReview ? (
                  <>
                    <button type="button" className="sabi-apt-view-btn" onClick={() => onViewDetails(apt)}>
                      View Request
                    </button>
                    <button type="button" className="sabi-apt-secondary-btn" onClick={() => onCancel(apt.id)}>
                      Cancel Request
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="sabi-apt-view-btn" onClick={() => onViewDetails(apt)}>
                      View Details
                    </button>
                    <button type="button" className="sabi-apt-secondary-btn" onClick={() => onCancel(apt.id)}>
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default UpcomingAppointments;

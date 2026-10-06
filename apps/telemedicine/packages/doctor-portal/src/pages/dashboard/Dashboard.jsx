import React, { useMemo, useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  ClipboardList,
  Mail,
  Wallet,
  Users,
  AlertTriangle,
  Clock,
  Video,
  Home,
  FileEdit,
  CalendarOff,
  RefreshCw,
} from "lucide-react";
import { PageTransition, StaggerGroup, StaggerItem } from "design-system";
import PortalLayout from "../../components/PortalLayout";
import CareBanner from "../../../../shared-portal/CareBanner";
import { useDoctorAppointments } from "../../hooks/useDoctorAppointments";
import { acceptAppointment, declineAppointment } from "../../store/doctorAppointmentStore";
import { getActivity, subscribeToActivity, addActivity, timeAgo } from "../../store/activityStore";
import { getThreads, subscribeToThreads } from "../../store/messageStore";
import { getQueue, subscribeToQueue } from "../../store/hospitalQueueStore";
import { earningsRows, earningsSummary } from "../../utils/earnings";
import { DOCTOR_PROFILE } from "../../data/doctorProfile";
import { todayISODate, fullDateLabel } from "../../utils/dateFormat";
import { visitTypeLabel, bookingSourceLabel } from "../../utils/visitType";
import { BlockTimeModal, AddressModal } from "./DashboardModals";
import "./DashboardModals.css";
import "./Dashboard.css";

function StatCard({ icon: Icon, label, value, tag, alert }) {
  return (
    <div className="dp-stat-card">
      <div className="dp-stat-top">
        <Icon size={18} />
        {tag && <span className="dp-stat-tag">{tag}</span>}
        {alert && <span className="dp-stat-alert-dot" />}
      </div>
      <div className="dp-stat-value">{value}</div>
      <div className="dp-stat-label">{label}</div>
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const appointments = useDoctorAppointments();
  const activity = useSyncExternalStore(subscribeToActivity, getActivity, getActivity);
  const today = todayISODate();
  const threads = useSyncExternalStore(subscribeToThreads, getThreads, getThreads);
  const queue = useSyncExternalStore(subscribeToQueue, getQueue, getQueue);
  const unread = threads.filter((thread) => thread.unread).length;
  const { thisWeek } = earningsSummary(earningsRows(appointments));

  const [blockModal, setBlockModal] = useState(false);
  const [addressAppt, setAddressAppt] = useState(null);

  const needsResponse = useMemo(
    () => appointments.filter((a) => a.status === "needs-response"),
    [appointments]
  );
  const todaysSchedule = useMemo(
    () =>
      appointments
        .filter((a) => a.date === today && a.status !== "needs-response" && a.status !== "declined" && a.status !== "cancelled")
        .sort((a, b) => (a.startTime > b.startTime ? 1 : -1)),
    [appointments, today]
  );

  function handleAccept(appt) {
    acceptAppointment(appt.id);
    addActivity(`Accepted ${appt.patientName}'s ${appt.requestType === "reschedule-request" ? "reschedule request" : "booking request"}.`);
  }
  function handleDecline(appt) {
    declineAppointment(appt.id);
    addActivity(`Declined ${appt.patientName}'s request.`);
  }

  return (
    <PortalLayout
      topbarProps={{
        placeholder: "Search patient records, IDs...",
        notificationCount: needsResponse.length,
        showAlert: true,
      }}
    >
      <PageTransition className="dp-dashboard"><CareBanner />
        <div className="dp-dashboard-heading">
          <h1>Good morning, {DOCTOR_PROFILE.firstNameGreeting}</h1>
          <p>{fullDateLabel(today)}</p>
        </div>

        <StaggerGroup className="dp-stats-row">
          <StaggerItem><StatCard icon={CalendarDays} label="Appointments" value={todaysSchedule.length} tag="Today" /></StaggerItem>
          <StaggerItem><StatCard icon={ClipboardList} label="Pending Requests" value={needsResponse.length} alert={needsResponse.length > 0} /></StaggerItem>
          <StaggerItem><StatCard icon={Mail} label="Unread Messages" value={unread} alert={unread > 0} /></StaggerItem>
          <StaggerItem><StatCard icon={Wallet} label="Earnings" value={`₦${thisWeek.toLocaleString()}`} tag="This Week" /></StaggerItem>
          <StaggerItem><StatCard icon={Users} label="Patients in Queue" value={queue.filter((q) => !q.assignedDoctorId).length} tag="Hospital" /></StaggerItem>
        </StaggerGroup>

        <div className="dp-dashboard-grid">
          <div className="dp-dashboard-col">
            <section className="dp-panel">
              <div className="dp-panel-header">
                <h2>
                  <AlertTriangle size={17} /> Needs Your Response
                </h2>
                <button className="dp-link-btn" onClick={() => navigate("/appointments?tab=needs-response")}>
                  View All
                </button>
              </div>

              {needsResponse.length === 0 ? (
                <p className="dp-empty">You're all caught up — no pending requests.</p>
              ) : (
                <div className="dp-response-list">
                  {needsResponse.map((appt) => (
                    <div className="dp-response-row" key={appt.id}>
                      <div className="dp-response-avatar" style={{ background: appt.color }}>
                        {appt.initials}
                      </div>
                      <div className="dp-response-info">
                        <div className="dp-response-name-row">
                          <span className="dp-response-name">{appt.patientName}</span>
                          <span className="dp-response-tag">
                            {appt.requestType === "reschedule-request" ? "Reschedule Request" : "Book in Advance"}
                          </span>
                        </div>
                        <div className="dp-response-sub">
                          {appt.requestType === "reschedule-request" ? (
                            <>
                              {appt.previousDate} @ {appt.previousStartTime} → {appt.date} @ {appt.startTime}
                            </>
                          ) : (
                            <>
                              {fullDateLabel(appt.date)} @ {appt.startTime}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="dp-response-actions">
                        <button className="dp-text-btn" onClick={() => navigate(`/appointments/${appt.id}`)}>
                          Details
                        </button>
                        <button className="dp-text-btn dp-text-btn-danger" onClick={() => handleDecline(appt)}>
                          Decline
                        </button>
                        <button className="dp-btn dp-btn-primary dp-btn-sm" onClick={() => handleAccept(appt)}>
                          Accept
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="dp-panel">
              <div className="dp-panel-header">
                <h2>
                  <Clock size={17} /> Today's Schedule
                </h2>
              </div>

              {todaysSchedule.length === 0 ? (
                <p className="dp-empty">Nothing scheduled for today yet.</p>
              ) : (
                <div className="dp-schedule-list">
                  {todaysSchedule.map((appt) => (
                    <div className="dp-schedule-row" key={appt.id}>
                      <div className="dp-schedule-time">{appt.startTime}</div>
                      <div className="dp-schedule-card">
                        <div className="dp-schedule-card-main">
                          <div className="dp-schedule-name-row">
                            {appt.type === "virtual" ? <Video size={14} /> : <Home size={14} />}
                            <span className="dp-schedule-name">{appt.patientName}</span>
                            <span className="dp-tag dp-tag-neutral">{visitTypeLabel(appt)}</span>
                          </div>
                          <div className="dp-schedule-sub">
                            {appt.type === "virtual"
                              ? "Virtual Consultation"
                              : appt.bookingSource === "affiliate"
                              ? `${bookingSourceLabel(appt)}${appt.room ? ` · ${appt.room}` : ""}`
                              : appt.bookedBy
                              ? `Booked by: ${appt.bookedBy}`
                              : "Direct booking · House call"}
                          </div>
                        </div>
                        {appt.type === "virtual" && (
                          <button className="dp-btn dp-btn-primary dp-btn-sm" onClick={() => navigate(`/consultations?patient=${encodeURIComponent(appt.patientName)}`)}>
                            <Video size={14} /> Join Call
                          </button>
                        )}
                        {appt.type === "physical" && appt.bookingSource === "direct" && (
                          <button className="dp-btn dp-btn-outline dp-btn-sm" onClick={() => setAddressAppt(appt)}>
                            View Address
                          </button>
                        )}
                        {appt.type === "physical" && appt.bookingSource === "affiliate" && appt.status === "checked-in" && (
                          <span className="dp-checked-in-tag">Checked In</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="dp-dashboard-col dp-dashboard-col-side">
            <section className="dp-panel">
              <h2 className="dp-panel-title-plain">Quick Actions</h2>
              <div className="dp-quick-actions">
                <button className="dp-btn dp-btn-primary dp-quick-btn" onClick={() => navigate("/prescriptions?new=1")}>
                  <FileEdit size={16} /> Write a Prescription
                </button>
                <button className="dp-btn dp-btn-outline dp-quick-btn" onClick={() => setBlockModal(true)}>
                  <CalendarOff size={16} /> Block Time Off
                </button>
                <button className="dp-link-btn dp-quick-link" onClick={() => navigate("/calendar")}>
                  View Full Schedule
                </button>
              </div>
            </section>

            <section className="dp-panel">
              <div className="dp-panel-header">
                <h2 className="dp-panel-title-plain">Recent Activity</h2>
                <button className="dp-icon-refresh" onClick={() => addActivity("Feed refreshed.")} aria-label="Refresh">
                  <RefreshCw size={15} />
                </button>
              </div>
              <div className="dp-activity-list">
                {activity.slice(0, 5).map((item) => (
                  <div className="dp-activity-row" key={item.id}>
                    <span className="dp-activity-dot" />
                    <div>
                      <div className="dp-activity-text">{item.text}</div>
                      <div className="dp-activity-time">{timeAgo(item.at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </PageTransition>

      {blockModal && (
        <BlockTimeModal onClose={() => setBlockModal(false)} onSaved={() => addActivity("Blocked time on your calendar.")} />
      )}
      {addressAppt && <AddressModal appointment={addressAppt} onClose={() => setAddressAppt(null)} />}
    </PortalLayout>
  );
}

export default Dashboard;

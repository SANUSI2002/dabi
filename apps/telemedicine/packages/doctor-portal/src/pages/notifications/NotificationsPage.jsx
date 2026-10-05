import React, { useMemo, useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, MessageSquare, UserPlus, Wallet, Star, CheckCheck } from "lucide-react";
import { PageTransition } from "design-system";
import PortalLayout from "../../components/PortalLayout";
import { useDoctorAppointments } from "../../hooks/useDoctorAppointments";
import { getThreads, subscribeToThreads, markThreadRead } from "../../store/messageStore";
import { getReviews, subscribeToReviews } from "../../store/reviewStore";
import { timeAgo } from "../../store/activityStore";
import "./NotificationsPage.css";

const FILTERS = ["All", "Appointments", "Messages", "Payments", "Reviews"];

export function NotificationsPage() {
  const navigate = useNavigate();
  const appointments = useDoctorAppointments();
  const threads = useSyncExternalStore(subscribeToThreads, getThreads, getThreads);
  const reviews = useSyncExternalStore(subscribeToReviews, getReviews, getReviews);
  const [filter, setFilter] = useState("All");
  const [readIds, setReadIds] = useState(new Set());

  const items = useMemo(() => {
    const list = [];

    appointments
      .filter((a) => a.status === "needs-response")
      .forEach((a) => {
        list.push({
          id: `nr-${a.id}`,
          category: "Appointments",
          icon: CalendarDays,
          title: "New Appointment Request",
          body: `New ${a.requestType === "reschedule-request" ? "reschedule" : "Book in Advance"} request from ${a.patientName} for ${a.date}.`,
          at: Date.now() - 1000 * 60 * 2,
          action: { label: "Review Request", onClick: () => navigate(`/appointments/${a.id}`) },
        });
      });

    appointments
      .filter((a) => a.status === "checked-in")
      .forEach((a) => {
        list.push({
          id: `ci-${a.id}`,
          category: "Appointments",
          icon: UserPlus,
          title: "Patient checked in",
          body: `${a.patientName} is ready${a.hospitalName ? ` at ${a.hospitalName}` : ""}.`,
          at: Date.now() - 1000 * 60 * 60 * 3,
          action: { label: "View Queue", onClick: () => navigate("/hospital-workspace") },
        });
      });

    threads
      .filter((t) => t.unread)
      .forEach((t) => {
        const last = t.messages[t.messages.length - 1];
        list.push({
          id: `msg-${t.id}`,
          category: "Messages",
          icon: MessageSquare,
          title: `New message from ${t.patientName}`,
          body: last?.text || "",
          at: last?.at || Date.now(),
          action: { label: "View Message", onClick: () => { markThreadRead(t.id); navigate("/messages"); } },
        });
      });

    if (reviews[0]) {
      const r = reviews[0];
      list.push({
        id: `rev-${r.id}`,
        category: "Reviews",
        icon: Star,
        title: `New ${r.rating}-star review`,
        body: `From ${r.patientName}: "${r.text.slice(0, 70)}${r.text.length > 70 ? "..." : ""}"`,
        at: Date.now() - 1000 * 60 * 60 * 48,
        action: { label: "View Review", onClick: () => navigate("/reviews") },
      });
    }

    return list.sort((a, b) => b.at - a.at);
  }, [appointments, threads, reviews, navigate]);

  const filtered = filter === "All" ? items : items.filter((i) => i.category === filter);

  function markAllRead() {
    getThreads().forEach((t) => t.unread && markThreadRead(t.id));
    setReadIds(new Set(items.map((i) => i.id)));
  }

  return (
    <PortalLayout topbarProps={{ placeholder: "Search notifications..." }}>
      <PageTransition className="dp-notif-page">
        <div className="dp-notif-heading">
          <h1>Notifications</h1>
          <button className="dp-btn dp-btn-outline dp-btn-sm" onClick={markAllRead}>
            <CheckCheck size={14} /> Mark all as read
          </button>
        </div>

        <div className="dp-registry-filter-pills">
          {FILTERS.map((f) => (
            <button key={f} className={`dp-pill${filter === f ? " dp-pill-active" : ""}`} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>

        <div className="dp-notif-list">
          {filtered.length === 0 && <p className="dp-empty">Nothing here.</p>}
          {filtered.map((item) => {
            const Icon = item.icon;
            const isRead = readIds.has(item.id);
            return (
              <div className={`dp-notif-card${isRead ? "" : " dp-notif-card-unread"}`} key={item.id}>
                <div className="dp-notif-card-icon">
                  <Icon size={17} />
                </div>
                <div className="dp-notif-card-body">
                  <div className="dp-notif-card-top">
                    <strong>{item.title}</strong>
                    <span className="dp-notif-card-time">{timeAgo(item.at)}</span>
                  </div>
                  <p>{item.body}</p>
                  {item.action && (
                    <button className="dp-btn dp-btn-primary dp-btn-sm" onClick={item.action.onClick}>
                      {item.action.label}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </PageTransition>
    </PortalLayout>
  );
}

export default NotificationsPage;

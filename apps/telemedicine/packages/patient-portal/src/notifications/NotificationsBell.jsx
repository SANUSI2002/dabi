import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CalendarClock, CheckCheck, ClipboardList, CreditCard, PackageCheck, Pill, Truck, FileText } from "lucide-react";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "../api/notificationsApi";
import {
  getNotifications,
  getUnreadCount,
  subscribeToNotifications,
  markRead,
  markAllRead,
} from "./notificationStore";

const KIND_ICON = {
  info: ClipboardList,
  success: CheckCheck,
  payment: CreditCard,
  delivery: Truck,
  delivered: PackageCheck,
  invoice: FileText,
  MEDICATION: Pill,
  APPOINTMENT: CalendarClock,
  CARE: ClipboardList,
};

// Notifications from the Sabi service (medicine reminders, prescriptions, care updates) shown next to
// the ones this browser keeps for pharmacy orders.
const fromServer = (n) => ({ id: `srv-${n.id}`, serverId: n.id, title: n.title, body: n.message, kind: n.category, read: n.isRead, createdAt: n.createdAt, link: n.link });
const REFRESH_MS = 60_000;

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(getNotifications);
  const [serverItems, setServerItems] = useState([]);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => subscribeToNotifications(() => setNotifications(getNotifications())), []);

  const refresh = useCallback(() => {
    listNotifications().then((page) => setServerItems((page?.items || []).map(fromServer))).catch(() => { /* the local list still shows */ });
  }, []);
  useEffect(() => {
    refresh();
    const timer = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => { if (open) refresh(); }, [open, refresh]);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const unread = getUnreadCount() + serverItems.filter((n) => !n.read).length;
  const items = [...serverItems, ...notifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const openItem = (n) => {
    if (!n.serverId) {
      markRead(n.id);
      if (n.link) { setOpen(false); navigate(n.link); }
      return undefined;
    }
    if (!n.read) {
      setServerItems((list) => list.map((item) => (item.id === n.id ? { ...item, read: true } : item)));
      markNotificationRead(n.serverId).catch(() => {});
    }
    if (n.link) { setOpen(false); navigate(n.link); }
    return undefined;
  };
  const readAll = () => {
    markAllRead();
    if (serverItems.some((n) => !n.read)) {
      setServerItems((list) => list.map((item) => ({ ...item, read: true })));
      markAllNotificationsRead().catch(() => {});
    }
  };

  return (
    <div className="sabi-notif-wrap" ref={ref}>
      <button
        className="sabi-icon-btn sabi-bell"
        aria-label="Notifications"
        type="button"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell />
        {unread > 0 && <span className="dot" />}
      </button>

      {open && (
        <div className="sabi-notif-panel">
          <div className="sabi-notif-panel-head">
            <h4>Notifications</h4>
            {unread > 0 && (
              <button type="button" onClick={readAll}>
                Mark all read
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="sabi-notif-empty">No notifications yet.</p>
          ) : (
            <div className="sabi-notif-list">
              {items.map((n) => {
                const Icon = KIND_ICON[n.kind] || ClipboardList;
                return (
                  <button
                    type="button"
                    key={n.id}
                    className={`sabi-notif-item${n.read ? "" : " unread"}`}
                    onClick={() => openItem(n)}
                  >
                    <span className="sabi-notif-icon">
                      <Icon size={15} />
                    </span>
                    <span className="sabi-notif-body">
                      <strong>{n.title}</strong>
                      {n.body && <span>{n.body}</span>}
                      <small>{timeAgo(n.createdAt)}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationsBell;

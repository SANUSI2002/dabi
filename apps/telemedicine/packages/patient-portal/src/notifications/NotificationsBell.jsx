import React, { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, ClipboardList, CreditCard, PackageCheck, Truck, FileText } from "lucide-react";
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
};

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
  const ref = useRef(null);

  useEffect(() => subscribeToNotifications(() => setNotifications(getNotifications())), []);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const unread = getUnreadCount();

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
              <button type="button" onClick={() => markAllRead()}>
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="sabi-notif-empty">No notifications yet.</p>
          ) : (
            <div className="sabi-notif-list">
              {notifications.map((n) => {
                const Icon = KIND_ICON[n.kind] || ClipboardList;
                return (
                  <button
                    type="button"
                    key={n.id}
                    className={`sabi-notif-item${n.read ? "" : " unread"}`}
                    onClick={() => markRead(n.id)}
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

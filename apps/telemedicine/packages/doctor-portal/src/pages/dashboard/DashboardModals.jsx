import React, { useState } from "react";
import { motion } from "framer-motion";
import { X, MapPin, ExternalLink } from "lucide-react";
import { addTimeBlock } from "../../store/doctorAppointmentStore";
import { todayISODate } from "../../utils/dateFormat";
import "./DashboardModals.css";

function ModalShell({ title, onClose, children }) {
  return (
    <motion.div
      className="dp-modal-overlay"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        className="dp-modal"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
      >
        <div className="dp-modal-header">
          <h2>{title}</h2>
          <button type="button" className="dp-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

export function BlockTimeModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    date: todayISODate(),
    start: "13:00",
    end: "14:00",
    reason: "",
  });

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function submit(e) {
    e.preventDefault();
    const toLabel = (t) => {
      const [h, m] = t.split(":").map(Number);
      const d = new Date();
      d.setHours(h, m);
      return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    };
    addTimeBlock({
      date: form.date,
      startTime: toLabel(form.start),
      endTime: toLabel(form.end),
      reason: form.reason || "Blocked",
    });
    onSaved?.();
    onClose();
  }

  return (
    <ModalShell title="Block Time Off" onClose={onClose}>
      <form className="dp-modal-body" onSubmit={submit}>
        <label>
          Date
          <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} required />
        </label>
        <div className="dp-modal-row">
          <label>
            Start
            <input type="time" value={form.start} onChange={(e) => set("start", e.target.value)} required />
          </label>
          <label>
            End
            <input type="time" value={form.end} onChange={(e) => set("end", e.target.value)} required />
          </label>
        </div>
        <label>
          Reason (private)
          <input value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="e.g. Medical Conference" />
        </label>
        <div className="dp-modal-actions">
          <button type="button" className="dp-btn dp-btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="dp-btn dp-btn-primary">
            Block time
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function AddressModal({ appointment, onClose }) {
  const query = encodeURIComponent(appointment.address || appointment.patientName);
  return (
    <ModalShell title="Visit address" onClose={onClose}>
      <div className="dp-modal-body">
        <div className="dp-address-row">
          <MapPin size={18} />
          <div>
            <div className="dp-address-line">{appointment.address || "Address on file"}</div>
            <div className="dp-address-sub">{appointment.patientName}</div>
          </div>
        </div>
        <a
          className="dp-btn dp-btn-primary dp-address-link"
          href={`https://www.google.com/maps/search/?api=1&query=${query}`}
          target="_blank"
          rel="noreferrer"
        >
          Get directions <ExternalLink size={14} />
        </a>
      </div>
    </ModalShell>
  );
}

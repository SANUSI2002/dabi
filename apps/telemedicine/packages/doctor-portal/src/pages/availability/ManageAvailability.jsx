import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, PlusCircle, Info } from "lucide-react";
import { PageTransition } from "design-system";
import PortalLayout from "../../components/PortalLayout";
import { useAvailability } from "../../hooks/useAvailability";
import { toggleDay, updateDayHours, updateSlotConfig, addOneOffBlock, removeOneOffBlock } from "../../store/doctorAvailabilityStore";
import { addActivity } from "../../store/activityStore";
import "./ManageAvailability.css";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function ManageAvailability() {
  const navigate = useNavigate();
  const availability = useAvailability();
  const [blockForm, setBlockForm] = useState({ label: "", date: "", start: "", end: "" });

  function submitBlock(e) {
    e.preventDefault();
    if (!blockForm.date || !blockForm.start || !blockForm.end) return;
    addOneOffBlock(blockForm);
    addActivity(`Blocked ${blockForm.label || "time"} on ${blockForm.date}.`);
    setBlockForm({ label: "", date: "", start: "", end: "" });
  }

  return (
    <PortalLayout topbarProps={{ placeholder: "Search..." }}>
      <PageTransition className="dp-avail">
        <div className="dp-avail-heading">
          <div>
            <h1>Manage Availability</h1>
            <p>Configure your clinical schedule and appointment slots.</p>
          </div>
          <button className="dp-btn dp-btn-primary" onClick={() => navigate("/calendar")}>
            <ArrowLeft size={15} /> Back to Calendar
          </button>
        </div>

        <div className="dp-avail-layout">
          <div className="dp-avail-col">
            <section className="dp-panel">
              <h2 className="dp-avail-section-title">Standing Weekly Hours</h2>
              <p className="dp-avail-section-sub">Set your recurring availability for consultations.</p>

              <div className="dp-week-rows">
                {DAYS.map((day) => {
                  const cfg = availability.weeklyHours[day];
                  return (
                    <div className="dp-week-row" key={day}>
                      <div className="dp-week-row-day">
                        <button
                          className={`dp-toggle${cfg.enabled ? " dp-toggle-on" : ""}`}
                          onClick={() => toggleDay(day)}
                          aria-pressed={cfg.enabled}
                          aria-label={`Toggle ${day}`}
                        >
                          <span className="dp-toggle-knob" />
                        </button>
                        <span>{day}</span>
                      </div>

                      {cfg.enabled ? (
                        <>
                          <div className="dp-week-row-times">
                            <input
                              type="time"
                              value={to24(cfg.start)}
                              onChange={(e) => updateDayHours(day, { start: to12(e.target.value) })}
                            />
                            <span>–</span>
                            <input
                              type="time"
                              value={to24(cfg.end)}
                              onChange={(e) => updateDayHours(day, { end: to12(e.target.value) })}
                            />
                          </div>
                          <div className="dp-week-row-checks">
                            <label>
                              <input type="checkbox" checked={cfg.virtual} onChange={(e) => updateDayHours(day, { virtual: e.target.checked })} />
                              Virtual
                            </label>
                            <label>
                              <input type="checkbox" checked={cfg.physical} onChange={(e) => updateDayHours(day, { physical: e.target.checked })} />
                              Physical
                            </label>
                          </div>
                        </>
                      ) : (
                        <span className="dp-week-row-unavailable">Unavailable</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="dp-panel">
              <h2 className="dp-avail-section-title">One-off Time Blocks</h2>
              <p className="dp-avail-section-sub">Block time for conferences, leave, or administrative work.</p>

              <form className="dp-block-form" onSubmit={submitBlock}>
                <label>
                  Date
                  <input type="date" value={blockForm.date} onChange={(e) => setBlockForm((f) => ({ ...f, date: e.target.value }))} required />
                </label>
                <label>
                  Time Range
                  <div className="dp-block-time-range">
                    <input type="time" value={blockForm.start} onChange={(e) => setBlockForm((f) => ({ ...f, start: e.target.value }))} required />
                    <span>–</span>
                    <input type="time" value={blockForm.end} onChange={(e) => setBlockForm((f) => ({ ...f, end: e.target.value }))} required />
                  </div>
                </label>
                <label>
                  Reason (Private)
                  <input
                    placeholder="e.g. Medical Conference"
                    value={blockForm.label}
                    onChange={(e) => setBlockForm((f) => ({ ...f, label: e.target.value }))}
                  />
                </label>
                <button type="submit" className="dp-block-add-btn" aria-label="Add block">
                  <Plus size={18} />
                </button>
              </form>

              <div className="dp-avail-section-sub" style={{ marginTop: 20, marginBottom: 8 }}>
                Upcoming Blocks
              </div>
              <div className="dp-upcoming-blocks">
                {availability.oneOffBlocks.length === 0 && <p className="dp-empty">No upcoming blocks.</p>}
                {availability.oneOffBlocks.map((b) => (
                  <div className="dp-upcoming-block-row" key={b.id}>
                    <div>
                      <div className="dp-upcoming-block-label">{b.label || "Blocked time"}</div>
                      <div className="dp-upcoming-block-time">
                        {b.date} · {b.start} - {b.end}
                      </div>
                    </div>
                    <button className="dp-icon-danger" onClick={() => removeOneOffBlock(b.id)} aria-label="Remove block">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="dp-avail-col dp-avail-col-side">
            <section className="dp-panel">
              <h2 className="dp-avail-section-title">Slot Configuration</h2>
              <p className="dp-avail-section-sub">Define the standard duration for your appointments.</p>

              <label className="dp-select-field">
                Consultation Duration
                <select
                  value={availability.slotConfig.consultationDuration}
                  onChange={(e) => updateSlotConfig({ consultationDuration: e.target.value })}
                >
                  <option>15 minutes</option>
                  <option>30 minutes</option>
                  <option>45 minutes</option>
                  <option>60 minutes</option>
                </select>
              </label>

              <label className="dp-select-field">
                Buffer Time (Between Slots)
                <select value={availability.slotConfig.bufferTime} onChange={(e) => updateSlotConfig({ bufferTime: e.target.value })}>
                  <option>No buffer</option>
                  <option>5 minutes</option>
                  <option>10 minutes</option>
                  <option>15 minutes</option>
                </select>
              </label>
            </section>

            <section className="dp-panel dp-affiliated-panel">
              <div className="dp-affiliated-header">
                <PlusCircle size={16} />
                <h2 className="dp-avail-section-title" style={{ margin: 0 }}>
                  Affiliated Hours
                </h2>
                <Info size={14} className="dp-affiliated-info" />
              </div>
              {Object.entries(
                availability.affiliatedHours.reduce((acc, h) => {
                  acc[h.hospital] = acc[h.hospital] || [];
                  acc[h.hospital].push(h);
                  return acc;
                }, {})
              ).map(([hospital, rows]) => (
                <div key={hospital}>
                  <div className="dp-affiliated-hospital">{hospital.toUpperCase()}</div>
                  {rows.map((r, i) => (
                    <div className="dp-affiliated-row" key={i}>
                      <span>{r.day}</span>
                      <span>
                        {r.start} - {r.end}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </section>
          </div>
        </div>
      </PageTransition>
    </PortalLayout>
  );
}

function to24(label) {
  // "09:00 AM" -> "09:00"
  const d = new Date(`2000-01-01 ${label}`);
  if (isNaN(d)) return "09:00";
  return d.toTimeString().slice(0, 5);
}
function to12(value24) {
  const [h, m] = value24.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export default ManageAvailability;

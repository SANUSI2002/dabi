import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Users, User2, Video, MapPin, Plus, Check, Clock3, Target, ShieldAlert,
} from "lucide-react";

import "../../styles/share.css";
import "./Wellness.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { getCategory, getPractitioner, createEngagementRequest } from "./wellnessStore";
import { TimePicker } from "./TimePicker";
import { getMembers } from "../family/familyStore";
import { getAddresses, addAddress } from "../pharmacy-market/cartStore";
import { formatNaira } from "../../utils/currency";

const WEEKDAYS = [
  { value: 1, label: "Mon" }, { value: 2, label: "Tue" }, { value: 3, label: "Wed" },
  { value: 4, label: "Thu" }, { value: 5, label: "Fri" }, { value: 6, label: "Sat" }, { value: 0, label: "Sun" },
];

const FITNESS_GOALS = ["Lose Weight / Fat Loss", "Build Muscle", "Improve Mobility", "Post-Injury Rehab", "General Fitness"];

export function BookPractitionerPage() {
  const [zoom] = useZoom();
  const { categoryId, practitionerId } = useParams();
  const navigate = useNavigate();

  const category = getCategory(categoryId);
  const practitioner = getPractitioner(practitionerId);
  const isCaregiver = categoryId === "caregiver";
  const members = getMembers();

  const [bookingForId, setBookingForId] = useState(members.find((m) => m.isSelf)?.id || "self");
  const bookingFor = members.find((m) => m.id === bookingForId) || members[0];

  const [durationDays, setDurationDays] = useState(30);
  const [visitType, setVisitType] = useState(practitioner?.supportsPhysical ? "physical" : "virtual");

  const [dailyStart, setDailyStart] = useState("08:00");
  const [dailyEnd, setDailyEnd] = useState("20:00");

  const [sessionHours, setSessionHours] = useState(1);
  const [daysOfWeek, setDaysOfWeek] = useState([1, 3, 5]);
  const [goal, setGoal] = useState(FITNESS_GOALS[0]);

  const [addresses, setAddresses] = useState(getAddresses);
  const [selectedAddressId, setSelectedAddressId] = useState(() => addresses.find((a) => a.isDefault)?.id || addresses[0]?.id || null);
  const [showAddressForm, setShowAddressForm] = useState(addresses.length === 0);
  const [newAddress, setNewAddress] = useState({ label: "", recipient: "", phone: "", address: "" });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);

  if (!category || !practitioner) {
    return (
      <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
        <Sidebar />
        <div className="sabi-main">
          <Topbar />
          <div className="sabi-card">
            <p>We couldn&apos;t find that practitioner.</p>
            <button className="sabi-btn-primary" onClick={() => navigate("/wellness-hub")}>Back to Wellness Hub</button>
          </div>
        </div>
      </div>
    );
  }

  // Every category (including Caregiver) now follows the same rule for
  // an independent (non-dependent) family member: booking is allowed,
  // they just have to accept or reject it themselves first — no hard
  // block. Only a dependent (or self) skips that step entirely.
  const needsTheirAcceptance = !bookingFor?.isSelf && bookingFor?.isDependent === false;

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) || null;
  const needsAddress = visitType === "physical";

  const estimatedSessions = isCaregiver
    ? durationDays
    : Math.max(1, Math.round((daysOfWeek.length * durationDays) / 7));

  const totalCost = isCaregiver
    ? practitioner.rate * durationDays
    : practitioner.rate * sessionHours * estimatedSessions;

  const canSubmit =
    (!needsAddress || Boolean(selectedAddress)) &&
    (isCaregiver || daysOfWeek.length > 0);

  const toggleDay = (value) => {
    setDaysOfWeek((prev) => (prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]));
  };

  const handleSaveNewAddress = () => {
    if (!newAddress.label.trim() || !newAddress.address.trim() || !newAddress.phone.trim()) return;
    const saved = addAddress(newAddress);
    const next = getAddresses();
    setAddresses(next);
    setSelectedAddressId(saved.id);
    setShowAddressForm(false);
    setNewAddress({ label: "", recipient: "", phone: "", address: "" });
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitting(true);
    window.setTimeout(() => {
      const request = createEngagementRequest({
        practitioner,
        bookingFor,
        durationDays,
        visitType,
        address: needsAddress ? selectedAddress : null,
        dailyStart: isCaregiver ? dailyStart : null,
        dailyEnd: isCaregiver ? dailyEnd : null,
        sessionHours: isCaregiver ? null : sessionHours,
        daysOfWeek: isCaregiver ? null : daysOfWeek,
        goal: categoryId === "fitness_coach" ? goal : null,
      });
      setSubmitting(false);
      setSubmitted(request);
    }, 600);
  };

  if (submitted) {
    const needsAcceptance = submitted.status === "awaiting_member_acceptance";
    return (
      <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
        <Sidebar />
        <div className="sabi-main">
          <Topbar />
          <div className="sabi-card sabi-hospitals-enroll-success">
            <div className="icon"><Clock3 size={36} /></div>
            <h2>{needsAcceptance ? `Booked ${practitioner.name} for ${bookingFor?.name}` : `Request sent to ${practitioner.name}`}</h2>
            <p>
              {needsAcceptance ? (
                <>
                  You&apos;ve booked {practitioner.name} ({category.label.replace(/s$/, "")}) for {bookingFor?.name}.
                  {" "}{bookingFor?.name} will get this request and can accept or reject it. If they accept,{" "}
                  {practitioner.name} will send {bookingFor?.name.split(" ")[0]} a schedule to review themself — you&apos;ll
                  just get notified once they&apos;ve accepted or rejected.
                </>
              ) : (
                <>
                  {practitioner.name} will review your request and propose a schedule for the {durationDays}-day
                  engagement — you&apos;ll be able to accept it or edit it once it arrives.
                </>
              )}
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button type="button" className="sabi-btn-outline" onClick={() => navigate("/wellness-hub")}>Back to Wellness Hub</button>
              <button type="button" className="sabi-btn-primary" onClick={() => navigate("/wellness-hub/engagements")}>
                View My Engagements
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main sabi-wellness-main">
        <Topbar />

        <button className="sabi-rxd-back" onClick={() => navigate(`/wellness-hub/${categoryId}/${practitionerId}`)}>
          <ArrowLeft size={18} /> Back to {practitioner.name}
        </button>

        <header className="sabi-hospitals-wizard-header">
          <div>
            <h1>Book {practitioner.name}</h1>
            <p>{category.label} · {formatNaira(practitioner.rate)} / {practitioner.rateUnit}</p>
          </div>
        </header>

        <div className="sabi-card sabi-hospitals-booking-for">
          <span className="sabi-booking-label"><Users size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} /> Booking For</span>
          <div className="sabi-hospitals-booking-for-row">
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`sabi-hospitals-booking-for-chip ${bookingForId === m.id ? "active" : ""}`}
                onClick={() => setBookingForId(m.id)}
              >
                {m.isSelf ? "Myself" : m.name}
              </button>
            ))}
          </div>
        </div>

        {needsTheirAcceptance && (
          <div className="sabi-hospitals-enroll-note">
            <ShieldAlert size={15} /> {bookingFor?.name} manages their own account — they&apos;ll need to accept or reject
            this booking first. Once they accept, {practitioner.name} will send {bookingFor?.name.split(" ")[0]} a
            schedule to review themself — you&apos;ll just get notified of their decision.
          </div>
        )}

        <div className="sabi-hospitals-wizard-layout">
            <div className="sabi-hospitals-booking-steps">
              <div className="sabi-card sabi-hospitals-wizard-card">
                <h3><span className="sabi-hospitals-step-num">1</span> Engagement Length</h3>
                <div className="sabi-wellness-duration-row">
                  {[30, 60].map((d) => (
                    <button key={d} type="button" className={durationDays === d ? "active" : ""} onClick={() => setDurationDays(d)}>
                      {d} Days
                    </button>
                  ))}
                </div>
              </div>

              {practitioner.supportsPhysical && (
                <div className="sabi-card sabi-hospitals-wizard-card">
                  <h3><span className="sabi-hospitals-step-num">2</span> Visit Type</h3>
                  <div className="sabi-hospitals-type-grid">
                    <button type="button" className={`sabi-hospitals-type-card ${visitType === "physical" ? "active" : ""}`} onClick={() => setVisitType("physical")}>
                      <MapPin size={22} />
                      <strong>Physical</strong>
                      <span>{practitioner.name.split(" ")[0]} comes to you.</span>
                    </button>
                    <button type="button" className={`sabi-hospitals-type-card ${visitType === "virtual" ? "active" : ""}`} onClick={() => setVisitType("virtual")}>
                      <Video size={22} />
                      <strong>Virtual</strong>
                      <span>Connect remotely.</span>
                    </button>
                  </div>
                </div>
              )}

              {needsAddress && (
                <div className="sabi-card sabi-hospitals-wizard-card">
                  <h3><MapPin size={18} /> Visit Address</h3>
                  {addresses.length > 0 && (
                    <div className="sabi-booking-address-grid">
                      {addresses.map((addr) => (
                        <button
                          type="button"
                          key={addr.id}
                          className={`sabi-booking-address-card ${selectedAddressId === addr.id ? "selected" : ""}`}
                          onClick={() => { setSelectedAddressId(addr.id); setShowAddressForm(false); }}
                        >
                          {selectedAddressId === addr.id && <span className="check"><Check size={14} /></span>}
                          <strong>{addr.label}</strong>
                          <span>{addr.address}</span>
                        </button>
                      ))}
                      <button type="button" className="sabi-booking-address-add" onClick={() => setShowAddressForm((s) => !s)}>
                        <Plus size={14} /> Use a different address
                      </button>
                    </div>
                  )}
                  {showAddressForm && (
                    <div className="sabi-booking-address-form">
                      <input type="text" placeholder="Label (e.g. Home)" value={newAddress.label} onChange={(e) => setNewAddress((p) => ({ ...p, label: e.target.value }))} />
                      <input type="text" placeholder="Recipient Name" value={newAddress.recipient} onChange={(e) => setNewAddress((p) => ({ ...p, recipient: e.target.value }))} />
                      <input type="text" placeholder="Phone Number" value={newAddress.phone} onChange={(e) => setNewAddress((p) => ({ ...p, phone: e.target.value }))} />
                      <input type="text" placeholder="Street, area, city" value={newAddress.address} onChange={(e) => setNewAddress((p) => ({ ...p, address: e.target.value }))} />
                      <button type="button" className="sabi-doctor-outline" onClick={handleSaveNewAddress}>Save Address</button>
                    </div>
                  )}
                </div>
              )}

              {isCaregiver ? (
                <div className="sabi-card sabi-hospitals-wizard-card">
                  <h3><Clock3 size={18} /> Daily Hours</h3>
                  <p className="sabi-hospitals-wizard-note">What time should {practitioner.name.split(" ")[0]} resume and leave each day?</p>
                  <div className="sabi-hospitals-form-grid">
                    <TimePicker label="Resume By" value={dailyStart} onChange={setDailyStart} />
                    <TimePicker label="Leave By" value={dailyEnd} onChange={setDailyEnd} />
                  </div>
                </div>
              ) : (
                <div className="sabi-card sabi-hospitals-wizard-card">
                  <h3><Clock3 size={18} /> Session Schedule</h3>
                  <label className="sabi-booking-field" style={{ marginBottom: 12 }}>
                    <span className="sabi-booking-label">Hours per Session</span>
                    <select value={sessionHours} onChange={(e) => setSessionHours(Number(e.target.value))}>
                      {[1, 1.5, 2].map((h) => <option key={h} value={h}>{h} hour{h === 1 ? "" : "s"}</option>)}
                    </select>
                  </label>
                  <span className="sabi-booking-label">Which Days</span>
                  <div className="sabi-wellness-days-row">
                    {WEEKDAYS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        className={daysOfWeek.includes(d.value) ? "active" : ""}
                        onClick={() => toggleDay(d.value)}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {categoryId === "fitness_coach" && (
                <div className="sabi-card sabi-hospitals-wizard-card">
                  <h3><Target size={18} /> Your Goal</h3>
                  <label className="sabi-booking-field">
                    <select value={goal} onChange={(e) => setGoal(e.target.value)}>
                      {FITNESS_GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </label>
                </div>
              )}
            </div>

            <aside className="sabi-hospitals-sidebar">
              <div className="sabi-card sabi-hospitals-booking-summary">
                <h4>Booking Summary</h4>
                <div className="row"><Users size={15} /><div><span>Booking For</span><strong>{bookingFor?.isSelf ? "Myself" : bookingFor?.name}</strong></div></div>
                <div className="row"><User2 size={15} /><div><span>Practitioner</span><strong>{practitioner.name}</strong></div></div>
                <div className="row"><Clock3 size={15} /><div><span>Duration</span><strong>{durationDays} days · ~{estimatedSessions} {isCaregiver ? "visits" : "sessions"}</strong></div></div>
                <div className="sabi-wellness-cost-line">
                  <span>Estimated Total</span>
                  <strong>{formatNaira(totalCost)}</strong>
                </div>
                <p className="sabi-wellness-cost-note">
                  {isCaregiver
                    ? `${formatNaira(practitioner.rate)}/day x ${durationDays} days`
                    : `${formatNaira(practitioner.rate)}/hr x ${sessionHours}hr x ${estimatedSessions} sessions`}
                </p>
                <button
                  type="button"
                  className="sabi-btn-primary sabi-btn-block"
                  style={{ marginTop: 14 }}
                  disabled={!canSubmit || submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? "Sending…" : "Send Booking Request"}
                </button>
              </div>
            </aside>
          </div>
      </div>
    </div>
  );
}

export default BookPractitionerPage;

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, Sparkles } from "lucide-react";

import "../../styles/share.css";
import "./Wellness.css";

import { useApiData } from "../../api/useApiData";
import { listMyWellnessBookings } from "../../api/sabiApi";
import { LoadState, PageShell, formatDateTime } from "../hospitals/hospitalShared";
import { BOOKING_STATUS, toBooking } from "./wellnessStore";

const FILTERS = [{ id: "", label: "All" }, ...Object.entries(BOOKING_STATUS).map(([id, s]) => ({ id, label: s.label }))];

export function EngagementsPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const bookings = useApiData(async () => (await listMyWellnessBookings(status ? { status } : {})).items.map(toBooking), [status]);

  return (
    <PageShell placeholder="Search wellness services..." mainClassName="sabi-main sabi-wellness-main">
      <button className="sabi-rxd-back" onClick={() => navigate("/wellness-hub")}>
        <ArrowLeft size={18} /> Back to Wellness Hub
      </button>
      <div className="sabi-wellness-list-header">
        <div>
          <h1>My Bookings</h1>
          <p>Every wellness booking and where it stands with the provider.</p>
        </div>
      </div>

      <div className="sabi-subject-picker" role="group" aria-label="Filter bookings by status">
        {FILTERS.map((f) => (
          <button type="button" key={f.id || "all"} aria-pressed={status === f.id} onClick={() => setStatus(f.id)}>{f.label}</button>
        ))}
      </div>

      <LoadState loading={bookings.loading} error={bookings.error} onRetry={bookings.reload} label="Loading bookings…">
        {(bookings.data || []).length === 0 ? (
          <div className="sabi-card sabi-live-state">
            <Sparkles size={32} />
            <h3>{status ? "No bookings with that status" : "No bookings yet"}</h3>
            <p>Browse the Wellness Hub to book a caregiver, coach, therapist or educator.</p>
            <button className="sabi-btn-primary" onClick={() => navigate("/wellness-hub")}>Browse services</button>
          </div>
        ) : (
          <div className="sabi-wellness-engagement-list">
            {bookings.data.map((b) => (
              <button type="button" className="sabi-card sabi-wellness-engagement-card" key={b.id} onClick={() => navigate(`/wellness-hub/engagements/${b.id}`)} style={{ textAlign: "left", width: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div>
                    <strong>{b.offering?.name || "Wellness booking"}</strong>
                    <p style={{ margin: "4px 0 0" }}>{b.offering?.providerName} · {formatDateTime(b.requestedAt)}</p>
                  </div>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className={`sabi-status-pill ${b.tone}`}>{b.statusLabel}</span>
                    <ChevronRight size={16} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </LoadState>
    </PageShell>
  );
}

export default EngagementsPage;

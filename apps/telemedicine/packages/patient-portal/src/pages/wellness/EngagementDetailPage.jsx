import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Clock3, Sparkles } from "lucide-react";

import "../../styles/share.css";
import "./Wellness.css";
import "../hospitals/Hospitals.css";

import { useApiData } from "../../api/useApiData";
import { getWellnessBooking } from "../../api/sabiApi";
import { LoadState, PageShell, formatDateTime, formatNaira } from "../hospitals/hospitalShared";
import { categoryLabel, toBooking } from "./wellnessStore";

const EXPLANATION = {
  PENDING: "The provider hasn't responded yet. You'll see the status change here once they confirm or decline.",
  CONFIRMED: "The provider has confirmed this booking. They'll contact you with any arrangements.",
  REJECTED: "The provider declined this request. You can book another time or another provider.",
  CANCELLED: "This booking was cancelled.",
};

export function EngagementDetailPage() {
  const { engagementId } = useParams();
  const navigate = useNavigate();
  const booking = useApiData(async () => toBooking(await getWellnessBooking(engagementId)), [engagementId]);
  const notFound = booking.error?.status === 404 || booking.error?.status === 400;
  const b = booking.data;

  return (
    <PageShell mainClassName="sabi-main sabi-wellness-main">
      <button className="sabi-rxd-back" onClick={() => navigate("/wellness-hub/engagements")}>
        <ArrowLeft size={18} /> Back to My Bookings
      </button>

      {notFound ? (
        <div className="sabi-card sabi-live-state">
          <Sparkles size={32} />
          <h3>We couldn&apos;t find that booking</h3>
          <button className="sabi-btn-primary" onClick={() => navigate("/wellness-hub/engagements")}>My Bookings</button>
        </div>
      ) : (
        <LoadState loading={booking.loading} error={booking.error} onRetry={booking.reload} label="Loading booking…">
          {b && (
            <div className="sabi-card sabi-hospitals-wizard-card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <h1 style={{ margin: 0 }}>{b.offering?.name || "Wellness booking"}</h1>
                <span className={`sabi-status-pill ${b.tone}`}>{b.statusLabel}</span>
              </div>
              <p className="sabi-hospitals-wizard-note"><BadgeCheck size={14} /> {b.offering?.providerName}{b.offering ? ` · ${categoryLabel(b.offering.category)}` : ""}</p>
              <div className="sabi-hospitals-review-grid">
                <div><span>Requested time</span><strong>{formatDateTime(b.requestedAt)}</strong></div>
                <div><span>Requested on</span><strong>{formatDateTime(b.createdAt)}</strong></div>
                {b.offering && <div><span>Price</span><strong>{b.offering.price > 0 ? formatNaira(b.offering.price) : "On request"}</strong></div>}
              </div>
              <p className="sabi-hospitals-wizard-note" style={{ marginTop: 14 }}><Clock3 size={14} /> {EXPLANATION[b.status] || ""}</p>
            </div>
          )}
        </LoadState>
      )}
    </PageShell>
  );
}

export default EngagementDetailPage;

import React, { useMemo, useState } from "react";
import { CreditCard, CalendarDays, Clock, Landmark, Filter, Download, Video, Home } from "lucide-react";
import { PageTransition } from "design-system";
import PortalLayout from "../../components/PortalLayout";
import { useDoctorAppointments } from "../../hooks/useDoctorAppointments";
import { visitTypeLabel } from "../../utils/visitType";
import { earningsRows, earningsSummary } from "../../utils/earnings";
import "./EarningsPage.css";

const STATUS_DOT = {
  Payable: "dp-dot-success",
  Paid: "dp-dot-neutral",
  "On Hold": "dp-dot-warning",
  Refunded: "dp-dot-danger",
};

export function EarningsPage() {
  const appointments = useDoctorAppointments().filter((a) => a.type !== "blocked" && a.status !== "needs-response");
  const [tab, setTab] = useState("overview");

  const rows = useMemo(() => earningsRows(appointments), [appointments]);
  const { thisWeek, thisMonth, pendingPayout } = earningsSummary(rows);

  return (
    <PortalLayout topbarProps={{ placeholder: "Search earnings..." }}>
      <PageTransition className="dp-earnings-page">
        <h1>Financial Command Center</h1>

        <div className="dp-earn-stats">
          <div className="dp-panel dp-earn-stat-card">
            <div className="dp-earn-stat-top">
              <span>THIS WEEK</span>
              <CreditCard size={16} />
            </div>
            <div className="dp-earn-stat-value">₦{thisWeek.toLocaleString()}</div>
            <div className="dp-earn-stat-trend">↗ +12.5% from last week</div>
          </div>
          <div className="dp-panel dp-earn-stat-card">
            <div className="dp-earn-stat-top">
              <span>THIS MONTH</span>
              <CalendarDays size={16} />
            </div>
            <div className="dp-earn-stat-value">₦{thisMonth.toLocaleString()}</div>
            <div className="dp-earn-stat-trend">↗ +4.2% from last month</div>
          </div>
          <div className="dp-panel dp-earn-stat-card">
            <div className="dp-earn-stat-top">
              <span>PENDING PAYOUT</span>
              <Clock size={16} />
            </div>
            <div className="dp-earn-stat-value">₦{pendingPayout.toLocaleString()}</div>
            <div className="dp-earn-stat-sub">Processing next transfer</div>
          </div>
          <div className="dp-panel dp-earn-stat-card">
            <div className="dp-earn-stat-top">
              <span>LIFETIME TOTAL</span>
              <Landmark size={16} />
            </div>
            <div className="dp-earn-stat-value">₦2,342,900</div>
            <div className="dp-earn-stat-sub">Since Jan 2024</div>
          </div>
        </div>

        <div className="dp-earn-tabs-row">
          <div className="dp-tabs dp-earn-tabs">
            <button className={`dp-tab${tab === "overview" ? " dp-tab-active" : ""}`} onClick={() => setTab("overview")}>
              Earnings Overview
            </button>
            <button className={`dp-tab${tab === "payouts" ? " dp-tab-active" : ""}`} onClick={() => setTab("payouts")}>
              Payout History
            </button>
          </div>
          <div className="dp-earn-actions">
            <button className="dp-btn dp-btn-outline dp-btn-sm">
              <Filter size={14} /> Filter
            </button>
            <button className="dp-btn dp-btn-outline dp-btn-sm">
              <Download size={14} /> Export
            </button>
          </div>
        </div>

        {tab === "overview" ? (
          <div className="dp-earn-table">
            <div className="dp-earn-table-header">
              <span>Patient / Date</span>
              <span>Visit Type</span>
              <span>Billing Note</span>
              <span>Gross Fee</span>
              <span>Status</span>
            </div>
            {rows.map((r) => (
              <div className="dp-earn-table-row" key={r.id}>
                <div>
                  <div className="dp-earn-patient">{r.patientName}</div>
                  {r.bookedBy && r.bookedBy !== "Self" && <div className="dp-earn-parent">{r.bookedBy}</div>}
                  <div className="dp-earn-date">
                    {r.date} · {r.startTime}
                  </div>
                </div>
                <span className="dp-earn-type-tag">
                  {r.type === "virtual" ? <Video size={12} /> : <Home size={12} />} {visitTypeLabel(r)}
                </span>
                <span className="dp-earn-billing">{r.billingNote}</span>
                <span className={`dp-earn-fee${r.amount < 0 ? " dp-earn-fee-negative" : ""}`}>
                  {r.amount < 0 ? "-" : ""}₦{Math.abs(r.amount).toLocaleString()}
                </span>
                <span className="dp-earn-status">
                  <span className={`dp-status-dot ${STATUS_DOT[r.status]}`} /> {r.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="dp-empty">Payout history will appear here once transfers have been processed.</p>
        )}
      </PageTransition>
    </PortalLayout>
  );
}

export default EarningsPage;

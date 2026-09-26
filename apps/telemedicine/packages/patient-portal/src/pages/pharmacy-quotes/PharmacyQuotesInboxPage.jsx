import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ReceiptText, Send } from "lucide-react";

import "../../styles/share.css";
import "./PharmacyQuotes.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { getSentPrescriptions } from "../prescriptions/prescriptionStore";
import { useApiData } from "../../api/useApiData";
import { listQuotes } from "../../api/commerceApi";

// Sent prescriptions, each with how many current quotes have come back.
async function loadInbox() {
  const [sent, quotes] = await Promise.all([getSentPrescriptions(), listQuotes()]);
  return sent.map((entry) => ({ ...entry, quoteCount: quotes.filter((q) => q.prescriptionId === entry.prescriptionId).length }));
}

export function PharmacyQuotesInboxPage() {
  const [zoom] = useZoom();
  const navigate = useNavigate();
  const { data, error } = useApiData(loadInbox, []);
  const sent = data || [];

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <main className="sabi-main sabi-quotes-main">
        <Topbar placeholder="Search for medications or pharmacies..." />

        <header className="sabi-quotes-header">
          <h1>Pharmacy Quotes &amp; Invoices</h1>
          <h2>Prescriptions you've sent out, and what pharmacies quoted back.</h2>
        </header>

        {!data ? (
          <p className="sabi-rx-empty">{error ? "We couldn't load your quotes. Please refresh to try again." : "Loading your quotes…"}</p>
        ) : sent.length === 0 ? (
          <div className="sabi-card sabi-empty-state">
            <ReceiptText size={40} />
            <h3>No prescriptions sent yet</h3>
            <p>Open a prescription, tap "Buy Now", and send it to one or more pharmacies — their quotes will show up here.</p>
            <button type="button" className="sabi-btn-primary" style={{ marginTop: 8 }} onClick={() => navigate("/prescriptions")}>
              Go to Prescriptions
            </button>
          </div>
        ) : (
          <div className="sabi-delivery-list">
            {sent.map(({ prescriptionId, pharmacyIds, sentAt, detail, quoteCount }) => (
              <button
                type="button"
                key={prescriptionId}
                className="sabi-delivery-list-item"
                onClick={() => navigate(`/prescriptions/${prescriptionId}/quotes`, { state: { pharmacyIds } })}
              >
                <div className="sabi-delivery-list-icon"><Send size={18} /></div>
                <div className="sabi-delivery-list-body">
                  <div className="sabi-delivery-list-top">
                    <strong>{detail.name}</strong>
                    <span className="sabi-delivery-status-pill current">{quoteCount ? `${quoteCount} Quote${quoteCount === 1 ? "" : "s"} Received` : "Awaiting Quotes"}</span>
                  </div>
                  <div className="sabi-delivery-list-meta">
                    <span>Sent to {pharmacyIds.length} pharmac{pharmacyIds.length === 1 ? "y" : "ies"}</span>
                    <span>{new Date(sentAt).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="sabi-delivery-list-items">
                    {detail.items.map((i) => i.name).join(", ")}
                  </div>
                </div>
                <div className="sabi-delivery-list-trail">
                  View Quotes <ArrowRight size={16} />
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default PharmacyQuotesInboxPage;

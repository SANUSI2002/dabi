import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ReceiptText, Send } from "lucide-react";

import "../../styles/share.css";
import "./PharmacyQuotes.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { getSentPrescriptions } from "../prescriptions/prescriptionStore";

export function PharmacyQuotesInboxPage() {
  const [zoom] = useZoom();
  const navigate = useNavigate();
  const [sent] = useState(getSentPrescriptions);

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <main className="sabi-main sabi-quotes-main">
        <Topbar placeholder="Search for medications or pharmacies..." />

        <header className="sabi-quotes-header">
          <h1>Pharmacy Quotes &amp; Invoices</h1>
          <h2>Prescriptions you've sent out, and what pharmacies quoted back.</h2>
        </header>

        {sent.length === 0 ? (
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
            {sent.map(({ prescriptionId, pharmacyIds, sentAt, detail }) => (
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
                    <span className="sabi-delivery-status-pill current">Awaiting Quotes</span>
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

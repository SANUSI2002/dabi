import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, AlertCircle, Clock, Store } from "lucide-react";

import "../../styles/share.css";
import "./PharmacyMarket.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { getRefillRecommendations } from "./refillRecommendationService";
import { useApiData } from "../../api/useApiData";

function formatDate(date) {
  return date ? new Date(date).toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : "No dispense record";
}

export function RefillPrescriptionPage() {
  const [zoom] = useZoom();
  const navigate = useNavigate();
  const { data, error } = useApiData(getRefillRecommendations, []);
  const recommendations = useMemo(() => data || [], [data]);
  const [selected, setSelected] = useState(() => new Set());
  useEffect(() => {
    setSelected(new Set(recommendations.filter((med) => med.eligible).map((med) => med.id)));
  }, [recommendations]);
  const [toast, setToast] = useState("");

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  const toggle = (med) => {
    if (!med.eligible) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(med.id) ? next.delete(med.id) : next.add(med.id);
      return next;
    });
  };

  const selectedMeds = useMemo(
    () => recommendations.filter((med) => selected.has(med.id)),
    [recommendations, selected]
  );

  const handleProceed = () => {
    if (selectedMeds.length === 0) {
      notify("Select at least one medication to refill");
      return;
    }
    // A refill needs today's prices, so the prescription goes back to pharmacies for fresh quotes.
    const prescriptionIds = [...new Set(selectedMeds.map((med) => med.prescriptionId))];
    if (prescriptionIds.length > 1) notify("Refill one prescription at a time — starting with the first");
    window.setTimeout(() => navigate(`/prescriptions/${prescriptionIds[0]}/select-pharmacy`), prescriptionIds.length > 1 ? 1200 : 0);
  };

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main sabi-storefront-main sabi-refill-page">
        <Topbar placeholder="Search medications..." />

        <button className="sabi-rxd-back" onClick={() => navigate("/pharmacy-market")}>
          <ArrowLeft size={18} /> Back to Marketplace
        </button>

        <div className="sabi-refill-heading">
          <div>
            <h1>Refill Prescription</h1>
            <p>We estimate availability from your dispense history, frequency, and days&apos; supply.</p>
          </div>
          <span className="sabi-refill-heading-note">Based on your orders</span>
        </div>

        {(!data || !recommendations.length) && (
          <p className="sabi-refill-heading-note" style={{ display: "block", marginBottom: 16 }}>
            {!data ? (error ? "We couldn't load your refills. Please refresh to try again." : "Loading your refills…") : "No refills yet — medicines you buy for your prescriptions will show up here."}
          </p>
        )}
        <div className="sabi-refill-grid">
          {recommendations.map((med) => {
            const checked = selected.has(med.id);
            return (
              <label
                key={med.id}
                className={`sabi-card sabi-refill-card ${!med.eligible ? "disabled" : ""} ${checked ? "selected" : ""}`}
              >
                <div className="sabi-refill-card-top">
                  <div className="sabi-refill-card-id">
                    <div className="sabi-refill-icon"><img src={med.photo} alt="" /></div>
                    <div>
                      <div className="sabi-refill-name">{med.name}</div>
                      <span className="sabi-refill-category">{med.category}</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!med.eligible}
                    onChange={() => toggle(med)}
                    className="sabi-refill-checkbox"
                  />
                </div>

                <div className="sabi-refill-card-meta">
                  <div className="sabi-refill-meta-item">
                    <span className="k">Dispensed</span>
                    <span className="v">{formatDate(med.lastDispensedAt)}</span>
                  </div>
                  <div className="sabi-refill-meta-item">
                    <span className="k">Remaining</span>
                    <span className={`v ${med.remainingUnits <= 7 ? "tone-low" : ""}`}>{med.remainingUnits} doses</span>
                  </div>
                </div>

                {med.eligible ? (
                  <div className="sabi-refill-card-footer">
                    <span><Clock size={13} /> {med.frequency} · {med.supply} doses / {med.durationDays} days</span>
                    <span className="sabi-pill">Suggested</span>
                  </div>
                ) : (
                  <div className="sabi-refill-blocked">
                    <AlertCircle size={14} /> {med.reason}
                  </div>
                )}
                <div className="sabi-refill-pharmacy"><Store size={13} /> Last bought from {med.pharmacyName}</div>
              </label>
            );
          })}
        </div>

        <div className="sabi-refill-footer-bar">
          <div className="sabi-refill-count">
            <span className="badge">{selectedMeds.length}</span>
            suggested refill{selectedMeds.length === 1 ? "" : "s"} selected
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="sabi-btn-outline" onClick={() => navigate("/pharmacy-market")}>
              Cancel
            </button>
            <button type="button" className="sabi-btn-primary" onClick={handleProceed}>
              Proceed to Refill →
            </button>
          </div>
        </div>

        {toast && <div className="sabi-toast">{toast}</div>}
      </div>
    </div>
  );
}

export default RefillPrescriptionPage;

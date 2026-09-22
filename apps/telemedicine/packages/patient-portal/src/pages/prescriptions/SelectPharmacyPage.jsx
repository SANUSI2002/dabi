import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Send, Truck, PackageCheck } from "lucide-react";

import "../../styles/share.css";
import "../pharmacy-market/PharmacyMarket.css";
import "./Prescriptions.css";
import "./PrescriptionDetail.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";

import { Sidebar, Topbar } from "../dashboard/components";
import { FilterTabs, MapPanel } from "../pharmacy-market/components";
import { PHARMACIES, PHARMACY_FILTERS, PHARMACY_SEARCH_CONFIG, PHARMACY_STATS } from "../pharmacy-market/data";
import { searchPharmacies } from "../pharmacy-market/pharmacySearch";
import { SelectPharmacyList } from "./components/SelectPharmacyList";
import { getPrescriptionDetail, recordSentToPharmacies } from "./prescriptionStore";

const MAX_PHARMACIES = 4;
const RADIUS_STEPS = PHARMACY_SEARCH_CONFIG.radiusSteps || [2, 4, 6, 8, 10];

export function SelectPharmacyPage() {
  const [zoom] = useZoom();
  const { id } = useParams();
  const navigate = useNavigate();
  const detail = getPrescriptionDetail(id);

  const [activeFilter, setActiveFilter] = useState(PHARMACY_FILTERS[0]);
  const [selectedIds, setSelectedIds] = useState([PHARMACIES[0].id]);
  const [sending, setSending] = useState(false);
  const [radiusKm, setRadiusKm] = useState(PHARMACY_SEARCH_CONFIG.defaultRadiusKm);
  const [deliveryPreference, setDeliveryPreference] = useState("delivery");
  const [notes, setNotes] = useState("");
  const [limitNotice, setLimitNotice] = useState("");

  if (!detail) {
    return (
      <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
        <Sidebar />
        <div className="sabi-main">
          <Topbar />
          <div className="sabi-card">
            <p>We couldn&apos;t find this prescription.</p>
            <button className="sabi-btn-primary" onClick={() => navigate("/prescriptions")}>
              Back to Prescriptions
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* DEBUG NOTE: Pharmacy search - Radius is capped by shared policy and ready for future recommendation ranking. */
  const pharmacySearch = useMemo(() => searchPharmacies({
    pharmacies: PHARMACIES,
    radiusKm,
    activeFilter,
    recommendationStrategy: PHARMACY_SEARCH_CONFIG.recommendationStrategy,
  }), [activeFilter, radiusKm]);
  const pharmacies = pharmacySearch.results;

  const flashLimitNotice = (message) => {
    setLimitNotice(message);
    window.setTimeout(() => setLimitNotice(""), 2600);
  };

  const toggle = (pharmacy) => {
    setSelectedIds((prev) => {
      if (prev.includes(pharmacy.id)) return prev.filter((pid) => pid !== pharmacy.id);
      if (prev.length >= MAX_PHARMACIES) {
        flashLimitNotice(`You can send a prescription to a maximum of ${MAX_PHARMACIES} pharmacies at once.`);
        return prev;
      }
      return [...prev, pharmacy.id];
    });
  };

  const handleSend = () => {
    if (!selectedIds.length) return;
    setSending(true);
    recordSentToPharmacies(id, selectedIds, { deliveryPreference, notes });
    window.setTimeout(() => {
      navigate(`/prescriptions/${id}/quotes`, { state: { pharmacyIds: selectedIds } });
    }, 700);
  };

  const selectedPharmacyForMap = PHARMACIES.find((p) => p.id === selectedIds[selectedIds.length - 1]);

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />

      <div className="sabi-main sabi-market-main">
        <Topbar placeholder="Search pharmacies..." />

        <button className="sabi-rxd-back" onClick={() => navigate(`/prescriptions/${id}`)}>
          <ArrowLeft size={18} strokeWidth={2} /> Back to Prescription
        </button>

        <header className="sabi-market-header">
          <div>
            <h1>Select a Pharmacy</h1>
            <p>
              Prescription for{" "}
              <strong>
                {detail.items.map((i) => i.name).join(", ")}
              </strong>{" "}
              {detail.items.length > 1 && `(${detail.items.length} medications)`}
            </p>
          </div>
          <span className="sabi-market-secure">
            <CheckCircle2 size={16} /> Verified pharmacy partners
          </span>
        </header>

        <div className="sabi-market-layout">
          <section className="sabi-market-results">
            <FilterTabs filters={PHARMACY_FILTERS} activeFilter={activeFilter} onChange={setActiveFilter} />

            <p className="sabi-market-location">
              <span>⌖</span>
              {pharmacies.length} Pharmacies found within {pharmacySearch.radiusKm}km of your location
            </p>

            <div className="sabi-market-radius-control">
              <label>
                {pharmacySearch.hasUnavailableMedication
                  ? "Increase search distance for more medication options"
                  : "Search radius"}
              </label>
              <div className="sabi-market-radius-steps">
                {RADIUS_STEPS.map((step) => (
                  <button
                    key={step}
                    type="button"
                    className={pharmacySearch.radiusKm === step ? "active" : ""}
                    onClick={() => setRadiusKm(step)}
                  >
                    {step}km
                  </button>
                ))}
              </div>
            </div>

            <SelectPharmacyList pharmacies={pharmacies} selectedIds={selectedIds} onToggle={toggle} />
          </section>

          <MapPanel pharmacies={pharmacies} selectedPharmacy={selectedPharmacyForMap} stats={PHARMACY_STATS} />
        </div>

        <div className="sabi-card sabi-select-pharmacy-prefs">
          <div className="sabi-booking-mode-row" style={{ marginBottom: 0 }}>
            <button
              type="button"
              className={deliveryPreference === "delivery" ? "active" : ""}
              onClick={() => setDeliveryPreference("delivery")}
            >
              <Truck size={16} /> Home Delivery
            </button>
            <button
              type="button"
              className={deliveryPreference === "pickup" ? "active" : ""}
              onClick={() => setDeliveryPreference("pickup")}
            >
              <PackageCheck size={16} /> Store Pickup
            </button>
          </div>
          <label className="sabi-booking-field" style={{ marginTop: "var(--sabi-space-md)" }}>
            <span className="sabi-booking-label">Notes for the Pharmacy (Optional)</span>
            <textarea
              rows={2}
              placeholder="e.g. Please call before delivery, or substitute with generic brand if unavailable…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>

        <div className="sabi-select-pharmacy-footer">
          <span>
            <strong>{selectedIds.length}</strong> of {MAX_PHARMACIES} pharmac{selectedIds.length === 1 ? "y" : "ies"} selected
          </span>
          <button
            type="button"
            className="sabi-btn-primary"
            disabled={!selectedIds.length || sending}
            onClick={handleSend}
          >
            <Send size={16} />
            {sending ? "Sending…" : `Send Prescription to ${selectedIds.length || 0} Pharmac${selectedIds.length === 1 ? "y" : "ies"}`}
          </button>
        </div>

        {limitNotice && <div className="sabi-toast">{limitNotice}</div>}
      </div>
    </div>
  );
}

export default SelectPharmacyPage;

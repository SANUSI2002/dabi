import React, { useEffect, useMemo, useState } from "react";
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
import { PHARMACY_FILTERS, PHARMACY_SEARCH_CONFIG } from "../pharmacy-market/data";
import { useApiData } from "../../api/useApiData";
import { discoverPharmacies } from "../../api/commerceApi";
import { SelectPharmacyList } from "./components/SelectPharmacyList";
import { getPrescriptionDetail, recordSentToPharmacies } from "./prescriptionStore";

const MAX_PHARMACIES = 4;
const RADIUS_STEPS = PHARMACY_SEARCH_CONFIG.radiusSteps || [2, 4, 6, 8, 10];
// Central Lagos, used when the browser can't share the patient's location.
const FALLBACK_LOCATION = { latitude: 6.5244, longitude: 3.3792, label: "central Lagos" };

function usePatientLocation() {
  const [location, setLocation] = useState(null);
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation(FALLBACK_LOCATION);
      return undefined;
    }
    let live = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => live && setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, label: "your location" }),
      () => live && setLocation(FALLBACK_LOCATION),
      { timeout: 8000, maximumAge: 300000 },
    );
    return () => { live = false; };
  }, []);
  return location;
}

// Discovery results in the shape the pharmacy cards and map read.
const toCard = (p) => ({
  id: p.id,
  name: p.name,
  rating: "New",
  distance: `${p.distanceKm}km away`,
  distanceKm: p.distanceKm,
  status: [p.city, p.state].filter(Boolean).join(", ") || "Verified partner",
  availability: "available",
  delivery: "quoted by pharmacy",
  lat: p.latitude,
  lng: p.longitude,
});

export function SelectPharmacyPage() {
  const [zoom] = useZoom();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: detail, loading } = useApiData(() => getPrescriptionDetail(id), [id]);
  const location = usePatientLocation();

  const [activeFilter, setActiveFilter] = useState(PHARMACY_FILTERS[0]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);
  const [radiusKm, setRadiusKm] = useState(PHARMACY_SEARCH_CONFIG.defaultRadiusKm);
  const [deliveryPreference, setDeliveryPreference] = useState("delivery");
  const [notes, setNotes] = useState("");
  const [limitNotice, setLimitNotice] = useState("");

  const { data: found } = useApiData(
    () => (location ? discoverPharmacies(id, { latitude: location.latitude, longitude: location.longitude, radiusKm }) : Promise.resolve(null)),
    [id, location, radiusKm],
  );
  const pharmacies = useMemo(() => (found || []).map(toCard), [found]);
  const pharmacySearch = { results: pharmacies, radiusKm, hasUnavailableMedication: false };
  const stats = {
    count: pharmacies.length,
    radius: `${radiusKm}km`,
    closestDistance: pharmacies[0] ? pharmacies[0].distance.replace(" away", "") : "—",
    deliveryTime: "Quoted by pharmacy",
  };

  // Start with the nearest pharmacy selected, as before.
  useEffect(() => {
    if (pharmacies.length && !selectedIds.length) setSelectedIds([pharmacies[0].id]);
  }, [pharmacies]);

  if (!detail) {
    return (
      <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
        <Sidebar />
        <div className="sabi-main">
          <Topbar />
          <div className="sabi-card">
            <p>{loading ? "Loading prescription…" : "We couldn't find this prescription."}</p>
            <button className="sabi-btn-primary" onClick={() => navigate("/prescriptions")}>
              Back to Prescriptions
            </button>
          </div>
        </div>
      </div>
    );
  }


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

  const handleSend = async () => {
    if (!selectedIds.length) return;
    setSending(true);
    setSendError("");
    try {
      await recordSentToPharmacies(id, selectedIds);
      navigate(`/prescriptions/${id}/quotes`, { state: { pharmacyIds: selectedIds, deliveryPreference } });
    } catch (err) {
      setSendError(err.message);
      setSending(false);
    }
  };

  const selectedPharmacyForMap = pharmacies.find((p) => p.id === selectedIds[selectedIds.length - 1]);

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
              {found ? `${pharmacies.length} Pharmacies found within ${pharmacySearch.radiusKm}km of ${location.label}` : "Finding verified pharmacies near you…"}
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

          <MapPanel pharmacies={pharmacies} selectedPharmacy={selectedPharmacyForMap} stats={stats} />
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

        {(limitNotice || sendError) && <div className="sabi-toast">{limitNotice || sendError}</div>}
      </div>
    </div>
  );
}

export default SelectPharmacyPage;

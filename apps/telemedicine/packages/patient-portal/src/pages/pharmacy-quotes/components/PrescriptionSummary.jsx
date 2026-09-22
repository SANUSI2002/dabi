import React from "react";
import { Pill, Sparkles } from "lucide-react";
import { HealthMap } from "../../../map/Map";

export function PrescriptionSummary({ prescription, selectedQuote }) {
  const coordinates = selectedQuote?.lat && selectedQuote?.lng
    ? [selectedQuote.lat, selectedQuote.lng]
    : [6.5244, 3.3792];

  return <aside className="sabi-quote-side"><section className="sabi-quote-prescription sabi-card"><p className="sabi-quote-eyebrow">ORIGINAL PRESCRIPTION</p><div className="sabi-quote-medication"><span><Pill /></span><div><h2>{prescription.medication}</h2><p>{prescription.supply}</p></div></div><dl><div><dt>Requested on</dt><dd>{prescription.requested}</dd></div><div><dt>Expires in</dt><dd className="danger">{prescription.expires}</dd></div><div><dt>Status</dt><dd><em>In Progress</em></dd></div></dl></section><section className="sabi-quote-suggestion"><p><Sparkles size={18} /> SMART SUGGESTION</p><strong>MedPlus Pharmacy offers the best price today. You save ₦1,700 compared to other responses.</strong><button type="button">Pay {selectedQuote?.total || "₦12,500"} Now →</button></section><section className="sabi-quote-nearby sabi-card"><div><h2>PHARMACIES NEARBY</h2><span>Expand Map</span></div>
    {/*
     * DEBUG/MAINTENANCE NOTE:
     * Replaced the static pharmacy mini-map placeholder with interactive <HealthMap /> from src/map.
     * Coordinates originate from the selected pharmacy quote, or use the Lagos fallback when quote geodata is unavailable.
     * Note: Map container requires an explicit height (.sabi-quote-interactive-map) for Leaflet tiles.
     */}
    <HealthMap key={selectedQuote?.id || "quote-fallback"} center={coordinates} zoom={14} markers={[{ id: selectedQuote?.id || "quote-fallback", lat: coordinates[0], lng: coordinates[1], title: selectedQuote?.name || "Nearby pharmacy" }]} className="sabi-quote-interactive-map w-full rounded-[14px] border-0" />
  </section></aside>;
}

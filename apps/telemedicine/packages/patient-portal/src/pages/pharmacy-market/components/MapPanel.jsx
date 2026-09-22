import React from "react";
import { HealthMap } from "../../../map/Map";

export function MapPanel({ pharmacies, selectedPharmacy, stats }) {
  const fallbackCenter = [6.62, 3.32];
  const center = selectedPharmacy?.lat && selectedPharmacy?.lng
    ? [selectedPharmacy.lat, selectedPharmacy.lng]
    : fallbackCenter;

  return <aside className="sabi-market-map" aria-label="Nearby pharmacy map">
    {/*
     * DEBUG/MAINTENANCE NOTE:
     * Replaced the CSS-drawn pharmacy map, roads, and pin placeholders with interactive <HealthMap /> from src/map.
     * Coordinates originate from the PHARMACIES data records, with an Agege, Lagos fallback center when none is selected.
     * Note: Map container requires an explicit height (.sabi-market-interactive-map) for Leaflet tiles.
     */}
    <HealthMap
      key={selectedPharmacy?.id || "pharmacy-fallback"}
      center={center}
      zoom={13}
      markers={pharmacies.map((pharmacy) => ({
        id: pharmacy.id,
        lat: pharmacy.lat,
        lng: pharmacy.lng,
        title: pharmacy.name,
        subtitle: pharmacy.distance,
        description: pharmacy.status,
      }))}
      className="sabi-market-interactive-map w-full rounded-none border-0"
    />
    <section className="sabi-market-distance sabi-card"><h2>Distance Breakdown</h2><div><span>Closest Pharmacy</span><strong>{stats.closestDistance}</strong></div><div><span>Avg. Delivery Time</span><strong>{stats.deliveryTime}</strong></div><p>All listed pharmacies are verified partners and support digital prescription direct-routing.</p></section>
  </aside>;
}

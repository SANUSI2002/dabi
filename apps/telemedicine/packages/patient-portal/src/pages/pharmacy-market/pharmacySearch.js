import { PHARMACY_SEARCH_CONFIG } from "./data";

const distanceInKm = (distance) => Number.parseFloat(distance) || 0;

/*
 * Shared pharmacy-search policy. `recommendationStrategy` is intentionally
 * declarative so a future Smart Selection provider can rank these results
 * without changing the search UI or its radius safeguards.
 */
export function searchPharmacies({ pharmacies, radiusKm, activeFilter, recommendationStrategy = "none" }) {
  const safeRadius = Math.min(
    PHARMACY_SEARCH_CONFIG.maxRadiusKm,
    Math.max(PHARMACY_SEARCH_CONFIG.defaultRadiusKm, radiusKm)
  );

  const results = pharmacies.filter((pharmacy) => {
    const withinRadius = distanceInKm(pharmacy.distance) <= safeRadius;
    const isOpen = pharmacy.status.includes("24") || pharmacy.status.includes("10");
    return withinRadius && (activeFilter !== "Open Now" || isOpen);
  });

  return {
    results,
    radiusKm: safeRadius,
    recommendationStrategy,
    hasUnavailableMedication: results.some((pharmacy) => pharmacy.availability !== "available"),
  };
}

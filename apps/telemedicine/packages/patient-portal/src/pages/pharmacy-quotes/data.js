import { listQuotes, listRequests, naira } from "../../api/commerceApi";
import { getPrescriptionDetail } from "../prescriptions/prescriptionStore";
import { formatNaira } from "../../utils/currency";

// Pharmacy quotes for one prescription, from the Sabi API, in the shape the quote cards and
// invoice read. `lines` is keyed by prescription item id; each line keeps the quote line id
// that a reservation needs. unavailableItemIds lists prescription items this pharmacy can't
// supply in full — everything else is available.

function toUiQuote(q, items) {
  const lines = {};
  for (const line of q.items || []) {
    lines[line.prescriptionItemId] = {
      quoteItemId: line.id,
      unitPrice: naira(line.unitPriceMinor),
      quantity: line.requiredQuantity,
      lineTotal: naira(line.lineTotalMinor),
      available: line.reservable && line.availabilityStatus === "AVAILABLE" && line.availableQuantity >= line.requiredQuantity,
      pickupAvailable: line.pickupAvailable,
      deliveryAvailable: line.deliveryAvailable,
      estimatedFulfilment: line.estimatedFulfilment,
    };
  }
  const unavailableItemIds = items.filter((item) => !lines[item.id]?.available).map((item) => item.id);
  const available = items.filter((item) => lines[item.id]?.available);
  const totalValue = available.reduce((sum, item) => sum + lines[item.id].lineTotal, 0);
  const pickup = available.some((item) => lines[item.id].pickupAvailable);
  const delivery = available.some((item) => lines[item.id].deliveryAvailable);
  const when = available[0] ? lines[available[0].id].estimatedFulfilment : "";
  const pharmacy = q.pharmacy || {};
  return {
    id: pharmacy.id,
    quoteId: q.id,
    name: pharmacy.name || "Pharmacy",
    rating: "New",
    distance: [pharmacy.city, pharmacy.state].filter(Boolean).join(", "),
    address: pharmacy.address,
    lat: pharmacy.latitude,
    lng: pharmacy.longitude,
    total: formatNaira(totalValue),
    totalValue,
    availability: available.length ? "Available" : "Out of Stock",
    eta: `Ready for ${[pickup && "Pickup", delivery && "Delivery"].filter(Boolean).join(" or ") || "Pickup"}${when ? ` (${when})` : ""}`,
    pickupAvailable: pickup,
    deliveryAvailable: delivery,
    deliveryFee: null,
    unavailableItemIds,
    lines,
    quoteExpiresAt: q.quoteExpiresAt,
  };
}

/** The prescription, its current quotes, and how many pharmacies it was sent to. */
export async function loadQuotes(prescriptionId) {
  const [detail, quotes, requests] = await Promise.all([getPrescriptionDetail(prescriptionId), listQuotes(), listRequests()]);
  if (!detail) return { detail: null, quotes: [], requestedCount: 0, expiresAt: null };
  const uiQuotes = quotes.filter((q) => q.prescriptionId === prescriptionId).map((q) => toUiQuote(q, detail.items));
  const cheapest = uiQuotes.filter((q) => q.availability !== "Out of Stock").sort((a, b) => a.totalValue - b.totalValue)[0];
  if (cheapest) cheapest.best = true;
  const expiresAt = uiQuotes.reduce((soonest, q) => (!soonest || q.quoteExpiresAt < soonest ? q.quoteExpiresAt : soonest), null);
  return {
    detail,
    quotes: uiQuotes,
    requestedCount: requests.filter((r) => r.prescriptionId === prescriptionId).length,
    expiresAt,
  };
}

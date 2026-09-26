import { listOrders, listPrescriptions, naira } from "../../api/commerceApi";
import { FREQUENCY_LABELS } from "../prescriptions/prescriptionStore";

const DAY = 24 * 60 * 60 * 1000;
const PHOTO = "https://images.unsplash.com/photo-1550572017-edd951b55104?w=400&q=80";
const PAID = new Set(["PAID"]);

const DOSES_PER_DAY = { TWICE_DAILY: 2, THREE_TIMES_DAILY: 3, FOUR_TIMES_DAILY: 4, EVERY_4_HOURS: 6, EVERY_6_HOURS: 4, EVERY_8_HOURS: 3, EVERY_12_HOURS: 2 };
const dosesPerDay = (frequency) => DOSES_PER_DAY[frequency] || 1;

/**
 * Refill suggestions from what the patient has actually bought: every paid order line for a
 * prescription that's still active, estimating how many doses are left from the quantity
 * bought, the prescribed frequency and the days since the order.
 */
export async function getRefillRecommendations() {
  const [orders, prescriptions] = await Promise.all([listOrders(), listPrescriptions()]);
  const itemIndex = new Map();
  for (const p of prescriptions) for (const item of p.items) itemIndex.set(item.id, { prescription: p, item });

  const latest = new Map(); // prescription item id -> most recent purchase
  for (const order of orders) {
    if (!PAID.has(order.status)) continue;
    for (const f of order.fulfilments || []) {
      for (const a of f.allocations || []) {
        const previous = latest.get(a.prescriptionItemId);
        if (!previous || new Date(order.createdAt) > new Date(previous.at)) {
          latest.set(a.prescriptionItemId, { at: order.createdAt, allocation: a, pharmacy: f.pharmacy });
        }
      }
    }
  }

  return [...latest.entries()].flatMap(([itemId, purchase]) => {
    const found = itemIndex.get(itemId);
    if (!found) return [];
    const { prescription, item } = found;
    const frequency = [item.dosage, FREQUENCY_LABELS[item.frequency]].filter(Boolean).join(", ") || "As prescribed";
    const supply = purchase.allocation.selectedQuantity;
    const dailyDoses = dosesPerDay(item.frequency);
    const daysSince = Math.max(0, Math.floor((Date.now() - new Date(purchase.at).getTime()) / DAY));
    const remainingUnits = Math.max(0, supply - daysSince * dailyDoses);
    const durationDays = Math.ceil(supply / dailyDoses);
    const refillWindowUnits = Math.max(dailyDoses * 7, Math.ceil(supply * 0.25));
    // A course of two weeks or less (e.g. "5 days") isn't something to refill.
    const days = Number(/(\d+)\s*day/i.exec(item.duration || "")?.[1]) || Number(/(\d+)\s*week/i.exec(item.duration || "")?.[1]) * 7 || null;
    const isShortCourse = days !== null && days <= 14;
    const eligible = !isShortCourse && remainingUnits <= refillWindowUnits;
    return [{
      id: `${prescription.id}-${itemId}`,
      prescriptionId: prescription.id,
      name: item.medicationName,
      category: item.indication || "Prescription",
      price: naira(purchase.allocation.unitPriceMinor),
      photo: PHOTO,
      pharmacyId: purchase.pharmacy?.id || null,
      pharmacyName: purchase.pharmacy?.name || "your last pharmacy",
      frequency,
      supply,
      durationDays,
      remainingUnits,
      lastDispensedAt: purchase.at,
      eligible,
      reason: isShortCourse
        ? "This was a short treatment course. Contact your prescriber before ordering more."
        : eligible
          ? "Suggested: your supply is running low."
          : `Refill becomes appropriate when about ${refillWindowUnits} doses remain.`,
    }];
  });
}

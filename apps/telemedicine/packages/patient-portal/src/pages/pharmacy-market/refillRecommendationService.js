import { getAllPrescriptionSummaries, getPrescriptionDetail } from "../prescriptions/prescriptionStore";
import { FEATURED_PHARMACIES } from "./marketplaceData";

const DAY = 24 * 60 * 60 * 1000;

// Temporary catalog enrichment for locally stored prescription records. A future
// refill API can return these fields (and pharmacy availability) directly.
const MEDICATION_CATALOG = {
  "lisinopril 10mg": { category: "Blood pressure", price: 15500, photo: "https://images.unsplash.com/photo-1550572017-edd951b55104?w=400&q=80" },
  "amlodipine 5mg": { category: "Blood pressure", price: 11200, photo: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&q=80" },
  "aspirin 75mg": { category: "Heart health", price: 7800, photo: "https://images.unsplash.com/photo-1550572017-edd951b55104?w=400&q=80" },
  "amoxicillin 500mg": { category: "Antibiotic", price: 19400, photo: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80" },
};

function dosesPerDay(instructions = "") {
  const value = instructions.toLowerCase();
  if (/3x|three times/.test(value)) return 3;
  if (/twice|2x/.test(value)) return 2;
  return 1;
}

function suppliedUnits(quantity = "") {
  return Number.parseInt(quantity, 10) || 0;
}

function latestDispense(detail, item) {
  return detail.refillHistory?.reduce((latest, entry) => {
    if (entry.itemId !== item.id || Number.isNaN(new Date(entry.dispensedAt).getTime())) return latest;
    if (!latest || new Date(entry.dispensedAt) > new Date(latest.dispensedAt)) return entry;
    return latest;
  }, null) || null;
}

function selectTemporaryPharmacy() {
  return FEATURED_PHARMACIES[Math.floor(Math.random() * FEATURED_PHARMACIES.length)];
}

/**
 * Local implementation of the future `GET /prescriptions/refill-recommendations`
 * contract. Keep the UI independent from the storage/API source by returning a
 * normalized recommendation per dispensed prescription item.
 */
export function getRefillRecommendations() {
  return getAllPrescriptionSummaries().flatMap((summary) => {
    const detail = getPrescriptionDetail(summary.id);
    if (!detail?.items?.length) return [];

    return detail.items.flatMap((item) => {
      const dispense = latestDispense(detail, item);
      if (!dispense) return [];

      const frequency = item.dosage || summary.frequency || "As prescribed";
      const supply = suppliedUnits(dispense?.supply || item.qty);
      const dailyDoses = dosesPerDay(frequency);
      const daysSinceDispense = Math.max(0, Math.floor((Date.now() - new Date(dispense.dispensedAt).getTime()) / DAY));
      const remainingUnits = Math.max(0, supply - (daysSinceDispense * dailyDoses));
      const durationDays = dailyDoses ? Math.ceil(supply / dailyDoses) : 0;
      const refillWindowUnits = Math.max(dailyDoses * 7, Math.ceil(supply * 0.25));
      const isShortCourse = /antibiotic|course length/i.test(`${summary.purpose} ${detail.diagnosis?.target?.label || ""}`);
      const eligible = Boolean(dispense) && !isShortCourse && remainingUnits <= refillWindowUnits;
      const pharmacy = selectTemporaryPharmacy();
      const catalog = MEDICATION_CATALOG[item.name.toLowerCase()] || { category: "Prescription", price: 10000, photo: "https://images.unsplash.com/photo-1550572017-edd951b55104?w=400&q=80" };

      return {
        id: `${summary.id}-${item.id}`,
        prescriptionId: summary.id,
        name: item.name,
        category: catalog.category,
        price: catalog.price,
        photo: catalog.photo,
        pharmacyId: pharmacy?.id || null,
        pharmacyName: pharmacy?.name || "a pharmacy partner",
        frequency,
        supply,
        durationDays,
        remainingUnits,
        lastDispensedAt: dispense?.dispensedAt || null,
        eligible,
        reason: isShortCourse
          ? "This was a short treatment course. Contact your prescriber before ordering more."
          : eligible
            ? "Suggested: your supply is running low."
            : `Refill becomes appropriate when about ${refillWindowUnits} doses remain.`,
      };
    });
  });
}

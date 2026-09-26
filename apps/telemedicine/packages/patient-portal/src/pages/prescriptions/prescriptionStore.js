import { getPrescription, listPrescriptions, listRequests, requestQuotes } from "../../api/commerceApi";
import { getDrugInfo } from "./drugInfo";

// Doctor-issued prescriptions from the Sabi API, shaped for the Prescriptions pages.
// Clinical wording (why this medication, side effects, interactions) comes from the
// drugInfo reference library; everything specific to the patient comes from the server.

// The server stores frequency and route as codes.
export const FREQUENCY_LABELS = {
  ONCE_DAILY: "once daily", TWICE_DAILY: "twice daily", THREE_TIMES_DAILY: "3 times daily", FOUR_TIMES_DAILY: "4 times daily",
  EVERY_4_HOURS: "every 4 hours", EVERY_6_HOURS: "every 6 hours", EVERY_8_HOURS: "every 8 hours", EVERY_12_HOURS: "every 12 hours",
  AS_NEEDED: "as needed", OTHER: "as directed",
};
const ROUTE_LABELS = {
  ORAL: "by mouth", TOPICAL: "on the skin", INHALATION: "inhaled", SUBCUTANEOUS: "under the skin", INTRAMUSCULAR: "into the muscle",
  INTRAVENOUS: "into a vein", RECTAL: "rectally", OPHTHALMIC: "in the eye", OTIC: "in the ear", NASAL: "in the nose", OTHER: "as directed",
};
const frequencyLabel = (code) => FREQUENCY_LABELS[code] || code || "";

const displayDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Not recorded";

const quantityLabel = (item) => (item.quantity ? `${item.quantity} ${item.quantity === 1 ? "unit" : "units"}` : "As prescribed");

const toItem = (item) => ({
  id: item.id,
  name: item.medicationName,
  dosage: [item.dosage, frequencyLabel(item.frequency)].filter(Boolean).join(", "),
  qty: quantityLabel(item),
  quantity: item.quantity,
  route: ROUTE_LABELS[item.route] || item.route,
  duration: item.duration,
  indication: item.indication,
});

const doctorName = (p) => p.doctorProfile?.user?.full_name || "Your doctor";

/** One card per prescription for the list and recent sections. */
export function toSummary(p) {
  const first = p.items[0] || {};
  const extra = p.items.length > 1 ? ` +${p.items.length - 1} more` : "";
  return {
    id: p.id,
    name: `${first.medicationName || "Prescription"}${extra}`,
    purpose: first.indication ? `For ${first.indication}` : "Prescribed medication",
    status: "Active",
    icon: "Pill",
    dosage: first.dosage || "",
    frequency: first.frequency ? frequencyLabel(first.frequency) : "As prescribed",
    prescribed: displayDate(p.issuedAt),
    fifthLabel: "DURATION",
    fifthValue: first.duration || "—",
    fifthDanger: false,
    itemCount: p.items.length,
    doctor: { name: doctorName(p), avatar: null },
  };
}

/** The full prescription for the detail, pharmacy and quotes pages. */
export function toDetail(p) {
  const items = p.items.map(toItem);
  const first = items[0] || {};
  const info = getDrugInfo(first.name || "");
  const instructions = [
    ...items.map((i) => `${i.name}: ${[i.dosage, i.route, i.duration && `for ${i.duration}`].filter(Boolean).join(", ")}`),
    ...(p.instructions ? [p.instructions] : []),
  ];
  return {
    id: p.id,
    name: items.length > 1 ? `${first.name} +${items.length - 1} more` : first.name || "Prescription",
    refId: p.reference,
    issueDate: displayDate(p.issuedAt),
    issuedAt: p.issuedAt,
    status: "ACTIVE PRESCRIPTION",
    physician: doctorName(p),
    physicianName: doctorName(p),
    items,
    refillHistory: [],
    diagnosis: {
      label: "REASON FOR PRESCRIPTION",
      title: first.indication || "As assessed by your doctor",
      description: p.instructions || `${doctorName(p)} issued this prescription on ${displayDate(p.issuedAt)}.`,
      target: { label: "Duration", value: first.duration || "As prescribed" },
    },
    whyThisMedication: info.whyThisMedication,
    dosageInstructions: instructions,
    sideEffects: info.sideEffects,
    sideEffectsNote: info.sideEffectsNote,
    criticalInteraction: info.criticalInteraction,
    recoveryForecast: {
      message: "Log your doses on the dashboard to see how you're keeping up with this prescription.",
      adherence: "—",
      nextSync: "When you log a dose",
    },
    nextDose: first.dosage ? `${first.dosage}${first.dosage.includes(",") ? "" : ", as prescribed"}` : "As prescribed",
  };
}

export async function getAllPrescriptionSummaries() {
  return (await listPrescriptions()).map(toSummary);
}

export async function getPrescriptionDetail(id) {
  try {
    return toDetail(await getPrescription(id));
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

// ---------------- Sent-to-pharmacy tracking ----------------
// Powers the Pharmacy Quotes inbox: every prescription that has been sent to pharmacies.

export async function recordSentToPharmacies(prescriptionId, pharmacyIds) {
  return requestQuotes(prescriptionId, pharmacyIds);
}

/** Sent prescriptions, newest first, with the pharmacies each went to. */
export async function getSentPrescriptions() {
  const requests = await listRequests();
  const byPrescription = new Map();
  for (const request of requests) {
    const entry = byPrescription.get(request.prescriptionId) || { prescriptionId: request.prescriptionId, pharmacyIds: [], pharmacies: [], sentAt: request.createdAt };
    entry.pharmacyIds.push(request.pharmacy?.id || request.pharmacyId);
    if (request.pharmacy) entry.pharmacies.push(request.pharmacy);
    if (request.createdAt < entry.sentAt) entry.sentAt = request.createdAt;
    byPrescription.set(request.prescriptionId, entry);
  }
  const entries = [...byPrescription.values()];
  const details = await Promise.all(entries.map((e) => getPrescriptionDetail(e.prescriptionId).catch(() => null)));
  return entries
    .map((entry, i) => (details[i] ? { ...entry, detail: details[i] } : null))
    .filter(Boolean)
    .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
}

/** When this prescription was first sent to pharmacies (quotes expire 24 hours after they're issued). */
export async function getSentAt(prescriptionId) {
  const requests = (await listRequests()).filter((r) => r.prescriptionId === prescriptionId);
  return requests.reduce((earliest, r) => (!earliest || r.createdAt < earliest ? r.createdAt : earliest), null);
}

// ---------------- Uploaded prescriptions ----------------
// Photos of prescriptions from other providers need a clinician review before any pharmacy
// can see them; that review isn't available yet, so uploads aren't kept as prescriptions.
export function addPrescriptionFromExtraction() {
  throw new Error("Uploaded prescriptions need a clinician review first. This is coming soon.");
}

export function removeUploadedPrescription() {
  return [];
}

import { PRESCRIPTIONS, PRESCRIPTION_DETAILS } from "./data";

const KEY = "sabi-uploaded-prescriptions";

// Prescriptions created via the "Prescription" upload/AI-detect flow
// aren't in the static seed data, so they're kept here (localStorage,
// same pattern as vitalsStore.js / familyStore.js) and merged with the
// static PRESCRIPTIONS / PRESCRIPTION_DETAILS wherever a prescription is
// looked up. This lets an uploaded prescription flow through the exact
// same "View Details → Buy Now → Select a Pharmacy → Send → Quotes"
// pipeline as a hospital-issued one.

function getStored() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  return [];
}

function persist(list) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  return list;
}

export function getAllPrescriptionSummaries() {
  const uploaded = getStored().map((detail) => ({
    id: detail.id,
    name: detail.name,
    purpose: "Uploaded Prescription",
    status: "Active",
    icon: "Pill",
    dosage: detail.items[0]?.dosage || "",
    frequency: "As prescribed",
    prescribed: detail.uploadedOn,
    fifthLabel: "REFILLS",
    fifthValue: detail.refillsLabel || "—",
    fifthDanger: false,
    itemCount: detail.items.length,
    doctor: { name: detail.physicianName, avatar: null },
    action: { label: "View Details", kind: "link" },
  }));
  return [...uploaded, ...PRESCRIPTIONS];
}

export function getPrescriptionDetail(id) {
  return PRESCRIPTION_DETAILS[id] || getStored().find((d) => d.id === id) || null;
}

// Builds a full PRESCRIPTION_DETAILS-shaped record from an AI-extracted
// (or on-file-selected) result, so it can be sent to pharmacies exactly
// like any other prescription.
export function addPrescriptionFromExtraction(extraction) {
  const id = `rx-up-${Date.now()}`;
  const detail = {
    id,
    name: extraction.drug,
    refId: `SB-${Math.floor(10000 + Math.random() * 89999)}-UP`,
    status: "ACTIVE PRESCRIPTION",
    physician: extraction.prescribedBy,
    physicianName: extraction.prescribedBy,
    uploadedOn: extraction.issueDate,
    refillsLabel: extraction.refills,
    source: "upload",
    items: [
      { id: "d1", name: extraction.drug, dosage: extraction.dosage, qty: extraction.form },
    ],
    diagnosis: {
      label: "FROM UPLOADED PRESCRIPTION",
      title: extraction.drug,
      description: `Prescribed by ${extraction.prescribedBy} on ${extraction.issueDate}. This record was created by matching your uploaded document against our drug database.`,
      target: { label: "Refills Remaining", value: extraction.refills },
    },
    whyThisMedication: [],
    dosageInstructions: [extraction.dosage],
    sideEffects: [],
    sideEffectsNote: "No side effects reported yet for this upload.",
    criticalInteraction: {
      title: "No Known Interactions Detected",
      body: "We didn't find a known interaction for this medication, but always confirm with your pharmacist before combining it with other drugs.",
    },
    recoveryForecast: {
      message: "This prescription was just added from an uploaded document, so there's no adherence history yet.",
      adherence: "—",
      nextSync: "Once you start logging doses",
    },
    nextDose: "As prescribed",
  };

  const next = [detail, ...getStored()];
  persist(next);
  return detail;
}

// Uploaded records are removable from the marketplace confirmation step.
// Static provider-issued prescriptions are deliberately not affected.
export function removeUploadedPrescription(id) {
  const next = getStored().filter((detail) => detail.id !== id);
  persist(next);
  return next;
}

// ---------------- Sent-to-pharmacy tracking ----------------
// Powers the Pharmacy Quotes inbox (/dashboard/pharmacy-quotes) — a
// list of every prescription that's actually been sent out, so the
// sidebar link opens something real instead of a dead redirect.

const SENT_KEY = "sabi-prescriptions-sent";

function getSentList() {
  try {
    const raw = window.localStorage.getItem(SENT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  return [];
}

export function recordSentToPharmacies(prescriptionId, pharmacyIds, meta = {}) {
  const list = getSentList().filter((s) => s.prescriptionId !== prescriptionId);
  const next = [
    {
      prescriptionId,
      pharmacyIds,
      sentAt: new Date().toISOString(),
      deliveryPreference: meta.deliveryPreference || "delivery",
      notes: meta.notes || "",
    },
    ...list,
  ];
  try {
    window.localStorage.setItem(SENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function getSentPrescriptions() {
  return getSentList()
    .map((entry) => {
      const detail = getPrescriptionDetail(entry.prescriptionId);
      return detail ? { ...entry, detail } : null;
    })
    .filter(Boolean);
}

// Powers the "Quote Expiry Timer" future enhancement — quotes are valid
// for a fixed window after the prescription was sent to pharmacies.
export function getSentAt(prescriptionId) {
  const entry = getSentList().find((s) => s.prescriptionId === prescriptionId);
  return entry?.sentAt || null;
}

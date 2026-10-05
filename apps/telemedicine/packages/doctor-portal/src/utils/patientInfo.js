// Deterministic pseudo patient ID from their name and initials, so the
// same patient always shows the same ID across pages without a real
// patient-records backend.
export function patientId(patientName, initials) {
  let hash = 0;
  for (let i = 0; i < patientName.length; i++) {
    hash = (hash * 31 + patientName.charCodeAt(i)) % 9973;
  }
  return `${initials}-${1000 + hash}`;
}

// Seeded allergy notes for the patients that appear in demo data —
// surfaced as a safety flag on the pre-consultation screen.
export const PATIENT_ALLERGIES = {
  "Eleanor Vance": ["Penicillin"],
  "Michael Chen": ["Peanuts"],
  "Sarah Johnson": [],
};

export function allergiesFor(patientName) {
  return PATIENT_ALLERGIES[patientName] || [];
}

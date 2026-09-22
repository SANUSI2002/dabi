// ---------------- Upload Prescription — sample AI extractions ----------------
// Kept small so the demo doesn't return the exact same drug every time.
export const SAMPLE_EXTRACTIONS = [
  {
    id: "upload-amox",
    drug: "Amoxicillin 500mg",
    dosage: "1 capsule, 3x daily",
    form: "30 Capsules · 1 Refill",
    prescribedBy: "Dr. Sarah Miller",
    issueDate: "Sept 12, 2024",
    expiration: "Mar 12, 2025",
    refills: "3 of 5",
    confidence: 96,
    price: 19400,
  },
  {
    id: "upload-lisinopril",
    drug: "Lisinopril 10mg",
    dosage: "1 tablet, once daily",
    form: "28 Tablets · 2 Refills",
    prescribedBy: "Dr. James Wilson",
    issueDate: "Oct 2, 2024",
    expiration: "Apr 2, 2025",
    refills: "5 of 6",
    confidence: 93,
    price: 15500,
  },
  {
    id: "upload-metformin",
    drug: "Metformin 500mg",
    dosage: "1 tablet, twice daily",
    form: "60 Tablets · 3 Refills",
    prescribedBy: "Dr. Elena Rodriguez",
    issueDate: "Sept 28, 2024",
    expiration: "Feb 28, 2025",
    refills: "2 of 4",
    confidence: 91,
    price: 12800,
  },
];

// Prescriptions already on file with Sabi Health (used by the "Choose
// record from prescription available" verification method).
export const PRESCRIPTIONS_ON_FILE = [
  { id: "rx-99281", label: "General Hospital - Dr. Miller", dated: "Sept 12, 2024", refId: "RX-99281", status: "Active", extraction: 0 },
  { id: "rx-44210", label: "City Wellness Center - Dr. Sarah Chen", dated: "Mar 05, 2024", refId: "RX-44210", status: "Expired", extraction: 1 },
];

// ---------------- Emergency medications by condition ----------------
// Matched against the patient's EMERGENCY_PROFILE.conditions using a
// simple keyword search (case-insensitive substring), so this works for
// any conditions text without needing an exact enum match.
export const CONDITION_EMERGENCY_DRUGS = [
  {
    keyword: "asthma",
    condition: "Asthma",
    drugs: [
      { id: "em-inhaler", name: "Salbutamol Inhaler (Ventolin) 100mcg", category: "Rescue Inhaler", price: 8500, photo: "https://images.unsplash.com/photo-1631815589968-fdb09a223b1e?w=400&q=80", note: "Keep within reach at all times" },
      { id: "em-loratidine", name: "Loratadine 10mg (24ct)", category: "Antihistamine", price: 4200, photo: "https://images.unsplash.com/photo-1550572017-edd951b55104?w=400&q=80", note: "For allergy-triggered flare-ups" },
      { id: "em-prednisolone", name: "Prednisolone 5mg (Short Course)", category: "Oral Steroid", price: 6100, photo: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80", note: "For severe flare-ups, as directed" },
    ],
  },
  {
    keyword: "hypertension",
    condition: "Hypertension",
    drugs: [
      { id: "em-lisinopril", name: "Lisinopril 10mg (28ct)", category: "Antihypertensive", price: 15500, photo: "https://images.unsplash.com/photo-1550572017-edd951b55104?w=400&q=80", note: "Take as prescribed — do not skip doses" },
      { id: "em-amlodipine", name: "Amlodipine 5mg (30ct)", category: "Antihypertensive", price: 11200, photo: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&q=80", note: "Common add-on for BP control" },
      { id: "em-bpmon", name: "Digital BP Monitor V2", category: "Medical Device", price: 69750, photo: "https://images.unsplash.com/photo-1631815589968-fdb09a223b1e?w=400&q=80", note: "Track readings at home" },
    ],
  },
  {
    keyword: "diabetes",
    condition: "Diabetes",
    drugs: [
      { id: "em-metformin", name: "Metformin 500mg (60ct)", category: "Antidiabetic", price: 12800, photo: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&q=80", note: "Take with meals" },
      { id: "em-glucose", name: "Glucose Tablets (Hypo Treatment)", category: "Emergency Glucose", price: 3500, photo: "https://images.unsplash.com/photo-1550572017-edd951b55104?w=400&q=80", note: "For low blood sugar episodes" },
      { id: "em-glucometer", name: "Blood Glucose Monitor Kit", category: "Medical Device", price: 32000, photo: "https://images.unsplash.com/photo-1631815589968-fdb09a223b1e?w=400&q=80", note: "Includes 25 test strips" },
    ],
  },
];

export const DEFAULT_MARKET_PHARMACY_ID = "sabi-premium";

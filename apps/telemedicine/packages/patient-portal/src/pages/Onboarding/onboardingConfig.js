// Config-driven onboarding data (spec sections 12, 14, 18-31, 45, 51, 53).
// Adding a new profession/org type later means adding one entry here —
// not a new form component. Matches the slugs used by AccountTypeSelection.

export const COUNTRIES = [
  "Nigeria",
  "Ghana",
  "Kenya",
  "South Africa",
  "United Kingdom",
  "United States",
  "Other",
];

export const YEARS_OF_EXPERIENCE = ["0–1", "2–5", "6–10", "11–15", "16+"];

export const CAREGIVER_TYPES = [
  "Parent",
  "Guardian",
  "Spouse",
  "Child",
  "Sibling",
  "Relative",
  "Professional caregiver",
  "Legal representative",
  "Other",
];

// ---------------------------------------------------------------------
// HEALTHCARE PROFESSIONALS (section 11-24)
// category groups which regulatory-body default + doc set applies.
// ---------------------------------------------------------------------

const REGULATORY_BODY_OPTIONS = {
  medical: ["MDCN (Medical and Dental Council of Nigeria)", "Other"],
  dental: ["MDCN (Medical and Dental Council of Nigeria)", "Other"],
  nursing: ["NMCN (Nursing and Midwifery Council of Nigeria)", "Other"],
  mental_health: [
    "MDCN (Medical and Dental Council of Nigeria)",
    "Association of Clinical Psychologists of Nigeria",
    "Other",
  ],
  allied_health: ["Allied Health Practitioners' Council", "Other"],
  pharmacy: ["PCN (Pharmacists Council of Nigeria)", "Other"],
  diagnostics: [
    "MLSCN (Medical Laboratory Science Council of Nigeria)",
    "Radiographers Registration Board of Nigeria",
    "Other",
  ],
  other: ["Other"],
};

const PROFESSIONAL_DOCUMENTS = {
  // shared by every regulated profession
  standard: [
    { key: "professionalLicense", label: "Professional Licence", required: true },
    { key: "governmentId", label: "Government-issued ID", required: true },
    { key: "qualificationDocument", label: "Proof of Qualification", required: true },
  ],
  // "other" still asks for whatever exists, per section 24
  flexible: [
    { key: "professionalLicense", label: "Licence / Certificate (if applicable)", required: false },
    { key: "governmentId", label: "Government-issued ID", required: true },
    { key: "qualificationDocument", label: "Proof of Qualification", required: true },
  ],
};

export const PROFESSIONAL_CONFIGS = {
  doctor: {
    label: "Doctor",
    category: "medical",
    portalName: "Doctor Portal",
    specialisationLabel: "Specialty",
    specialisationOptions: [
      "General Practitioner",
      "Medical Doctor",
      "Surgeon",
      "Paediatrician",
      "Cardiologist",
      "Neurologist",
      "Oncologist",
      "Gynaecologist",
      "Obstetrician",
      "Urologist",
      "Orthopaedic Specialist",
      "Ophthalmologist",
      "ENT Specialist",
      "Other Medical Specialist",
    ],
    registrationLabel: "Medical Registration Number",
    regulatoryBodies: REGULATORY_BODY_OPTIONS.medical,
    requiresRegistration: true,
    documents: PROFESSIONAL_DOCUMENTS.standard,
  },
  nurse: {
    label: "Nurse",
    category: "nursing",
    portalName: "Nursing Portal",
    specialisationLabel: "Nursing Specialty",
    specialisationOptions: [
      "Registered Nurse",
      "Nurse Practitioner",
      "Community Health Nurse",
      "Other Nursing Professional",
    ],
    registrationLabel: "Nursing Registration Number",
    regulatoryBodies: REGULATORY_BODY_OPTIONS.nursing,
    requiresRegistration: true,
    documents: PROFESSIONAL_DOCUMENTS.standard,
  },
  dentist: {
    label: "Dentist",
    category: "dental",
    portalName: "Practitioner Portal",
    specialisationLabel: "Dental Specialty",
    specialisationOptions: [
      "Dentist (General)",
      "Orthodontist",
      "Periodontist",
      "Oral Surgeon",
      "Dental Hygienist",
      "Other Dental Professional",
    ],
    registrationLabel: "Dental Registration Number",
    regulatoryBodies: REGULATORY_BODY_OPTIONS.dental,
    requiresRegistration: true,
    documents: PROFESSIONAL_DOCUMENTS.standard,
  },
  dermatologist: {
    label: "Dermatologist",
    category: "medical",
    portalName: "Practitioner Portal",
    specialisationLabel: "Dermatology Specialty",
    specialisationOptions: [
      "General Dermatology",
      "Cosmetic Dermatology",
      "Paediatric Dermatology",
      "Dermatopathology",
      "Other",
    ],
    registrationLabel: "Medical Registration Number",
    regulatoryBodies: REGULATORY_BODY_OPTIONS.medical,
    requiresRegistration: true,
    documents: PROFESSIONAL_DOCUMENTS.standard,
  },
  psychiatrist: {
    label: "Psychiatrist",
    category: "mental_health",
    portalName: "Mental Health Practitioner Portal",
    specialisationLabel: "Mental Health Specialty",
    specialisationOptions: [
      "General Psychiatry",
      "Child & Adolescent Psychiatry",
      "Addiction Psychiatry",
      "Other",
    ],
    registrationLabel: "Professional Registration Number",
    regulatoryBodies: REGULATORY_BODY_OPTIONS.mental_health,
    requiresRegistration: true,
    documents: PROFESSIONAL_DOCUMENTS.standard,
    sensitiveNote:
      "Do not include any patient information here — this is your own professional registration.",
  },
  psychologist: {
    label: "Psychologist",
    category: "mental_health",
    portalName: "Mental Health Practitioner Portal",
    specialisationLabel: "Mental Health Specialty",
    specialisationOptions: [
      "Clinical Psychologist",
      "Counsellor",
      "Therapist",
      "Other Mental Health Professional",
    ],
    registrationLabel: "Professional Registration Number",
    regulatoryBodies: REGULATORY_BODY_OPTIONS.mental_health,
    requiresRegistration: true,
    documents: PROFESSIONAL_DOCUMENTS.standard,
    sensitiveNote:
      "Do not include any patient information here — this is your own professional registration.",
  },
  physiotherapist: {
    label: "Physiotherapist",
    category: "allied_health",
    portalName: "Practitioner Portal",
    specialisationLabel: "Area of Practice",
    specialisationOptions: [
      "Orthopedic",
      "Neurological",
      "Paediatric",
      "Sports",
      "Other",
    ],
    registrationLabel: "Professional Registration Number",
    regulatoryBodies: REGULATORY_BODY_OPTIONS.allied_health,
    requiresRegistration: true,
    documents: PROFESSIONAL_DOCUMENTS.standard,
  },
  pharmacist: {
    label: "Pharmacist",
    category: "pharmacy",
    portalName: "Pharmacist Portal",
    specialisationLabel: "Area of Practice",
    specialisationOptions: [
      "Community Pharmacy",
      "Hospital Pharmacy",
      "Clinical Pharmacy",
      "Other",
    ],
    registrationLabel: "Pharmacy Registration Number",
    regulatoryBodies: REGULATORY_BODY_OPTIONS.pharmacy,
    requiresRegistration: true,
    documents: PROFESSIONAL_DOCUMENTS.standard,
  },
  nutritionist: {
    label: "Nutritionist / Dietitian",
    category: "allied_health",
    portalName: "Practitioner Portal",
    specialisationLabel: "Area of Practice",
    specialisationOptions: ["Nutritionist", "Dietitian", "Other"],
    registrationLabel: "Professional Registration Number",
    regulatoryBodies: REGULATORY_BODY_OPTIONS.allied_health,
    requiresRegistration: false,
    documents: PROFESSIONAL_DOCUMENTS.flexible,
  },
  optometrist: {
    label: "Optometrist",
    category: "allied_health",
    portalName: "Practitioner Portal",
    specialisationLabel: "Area of Practice",
    specialisationOptions: ["General Optometry", "Other"],
    registrationLabel: "Professional Registration Number",
    regulatoryBodies: REGULATORY_BODY_OPTIONS.allied_health,
    requiresRegistration: true,
    documents: PROFESSIONAL_DOCUMENTS.standard,
  },
  midwife: {
    label: "Midwife",
    category: "nursing",
    portalName: "Practitioner Portal",
    specialisationLabel: "Area of Practice",
    specialisationOptions: ["Midwife", "Community Midwife", "Other"],
    registrationLabel: "Nursing/Midwifery Registration Number",
    regulatoryBodies: REGULATORY_BODY_OPTIONS.nursing,
    requiresRegistration: true,
    documents: PROFESSIONAL_DOCUMENTS.standard,
  },
  other: {
    label: "Other Healthcare Professional",
    category: "other",
    portalName: "Practitioner Portal",
    freeformProfession: true,
    specialisationLabel: "Specialty",
    specialisationOptions: null,
    registrationLabel: "Registration Number (if applicable)",
    regulatoryBodies: REGULATORY_BODY_OPTIONS.other,
    requiresRegistration: false,
    documents: PROFESSIONAL_DOCUMENTS.flexible,
  },
};

export function humanizeSlug(slug) {
  if (!slug) return "";
  return slug
    .split("-")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

// Placeholder content for the Profile Settings page.
// Swap for real API data / form state once you wire this up —
// right now every field is uncontrolled (defaultValue only) and
// "Save All Changes" / individual buttons are not yet functional.

export const PROFILE = {
  name: "Kwame Adebayo",
  since: "October 2021",
  initials: "KA",
  activeAccount: true,
};

export const PERSONAL_INFO = {
  fullName: "Kwame Adebayo",
  email: "kwame.adebayo@hospital.com",
  phone: "+1 (555) 000-1234",
  dob: "06/15/1985",
};

export const MEDICAL_HISTORY = {
  bloodType: "O+",
  genotype: "AA",
  chronicConditions: "",
};

export const BLOOD_TYPE_OPTIONS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

export const ALLERGIES_MEDICATIONS = {
  knownAllergies: "",
  currentMedications: "",
};

export const LIFESTYLE = {
  smokingStatus: "Never",
  alcoholFrequency: "None",
  physicalActivity: "",
};

export const SMOKING_OPTIONS = ["Never", "Former", "Current"];
export const ALCOHOL_OPTIONS = ["None", "Occasional", "Moderate", "Frequent"];

export const PAYMENT = {
  cardNumber: "123456789",
  expDate: "09-2026",
};

export const NOTIFICATIONS = [
  { key: "appointments", label: "Appointment Reminders", field: "appointmentReminders" },
  { key: "refills", label: "Prescription Refill Alerts", field: "prescriptionAlerts" },
  { key: "newsletter", label: "Health Tips & Newsletter", field: "healthTips" },
];

export const CONSENTS = [
  {
    key: "dataSharing",
    title: "Data Sharing Consent",
    description: "Allow sharing anonymized data for research purposes.",
    field: "dataSharing",
  },
  {
    key: "ehr",
    title: "Electronic Health Records",
    description: "Agreement to use digital health records for all consultations.",
    field: "electronicRecords",
  },
];

export const SECURITY = {
  lastChanged: "3 months ago",
  twoFactorEnabled: true,
};

// Patient profile & settings (/api/v1/profile). The form works on a flat camelCase model;
// only fields that actually changed are sent, so a save never overwrites untouched data.
import { authorizedRequest } from "../utils/sabiIdentity";

export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export const GENOTYPES = ["AA", "AS", "SS", "AC", "SC", "CC"];
export const SMOKING_OPTIONS = ["Never", "Former", "Current"];
export const ALCOHOL_OPTIONS = ["None", "Occasional", "Moderate", "Frequent"];

// Record categories a verified hospital may open in an emergency (server vocabulary).
export const EMERGENCY_ACCESS_OPTIONS = [
  { value: "Appointments", description: "Upcoming and recent care visits" },
  { value: "Prescriptions", description: "Current and recent medication orders" },
  { value: "Vitals", description: "Recent readings and trends" },
  { value: "Labs", label: "Lab Results", description: "Available laboratory reports" },
  { value: "Medical Records", description: "Clinical records and care history" },
];

// form key -> [API key, default when the server has no value]
const FIELDS = {
  fullName: ["full_name", ""],
  phone: ["phone_number", ""],
  dob: ["dob", ""],
  bloodType: ["blood_type", ""],
  genotype: ["genotype", ""],
  chronicConditions: ["chronic_conditions", ""],
  knownAllergies: ["known_allergies", ""],
  currentMedications: ["current_medications", ""],
  smokingStatus: ["smoking_status", ""],
  alcoholFrequency: ["alcohol_frequency", ""],
  physicalActivity: ["physical_activity", ""],
  appointmentReminders: ["appointment_reminders", true],
  prescriptionAlerts: ["prescription_alerts", true],
  healthTips: ["health_tips_newsletter", false],
  dataSharing: ["data_sharing_consent", false],
  electronicRecords: ["electronic_health_records", true],
  contactName: ["emergencyContactName", ""],
  contactPhone: ["emergencyContactPhone", ""],
  contactRelation: ["emergencyContactRelation", ""],
  emergencyAccess: ["emergency_access_permissions", []],
};
const USER_FIELDS = new Set(["full_name", "phone_number", "dob"]);

export function toForm(data) {
  const profile = data || {};
  const user = profile.user || {};
  const form = {};
  for (const [key, [apiKey, fallback]] of Object.entries(FIELDS)) {
    const raw = USER_FIELDS.has(apiKey) ? user[apiKey] : profile[apiKey];
    form[key] = raw ?? fallback;
  }
  if (form.dob) form.dob = String(form.dob).slice(0, 10);
  return { form, account: { email: user.email || "", patientId: user.patientId || "" } };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const changedKeys = (form, saved) => Object.keys(FIELDS).filter((key) => !same(form[key], saved[key]));

/** Client-side checks mirroring the API's rules, so the patient sees problems before saving. */
export function validate(form, saved) {
  const errors = {};
  if (form.fullName.trim().length < 2) errors.fullName = "Enter your full name.";
  if (form.phone.trim() && form.phone.trim().length < 10) errors.phone = "Enter a phone number with at least 10 digits.";
  if (!form.phone.trim() && saved.phone) errors.phone = "A phone number is required once added.";
  if (!form.dob && saved.dob) errors.dob = "Enter your date of birth.";
  if (form.dob && form.dob > new Date().toISOString().slice(0, 10)) errors.dob = "Date of birth can't be in the future.";
  const contact = [form.contactName, form.contactPhone, form.contactRelation].map((v) => v.trim());
  if (contact.some(Boolean)) {
    if (contact[0].length < 2) errors.contactName = "Enter the contact's name.";
    if (contact[1].length < 7) errors.contactPhone = "Enter the contact's phone number.";
    if (contact[2].length < 2) errors.contactRelation = "Enter how they're related to you.";
  }
  return errors;
}

export async function getProfile() {
  const result = await authorizedRequest("/api/v1/profile");
  return toForm(result.data);
}

/** Saves only the changed fields and returns the server's view of the whole profile. */
export async function saveProfile(form, saved) {
  const body = {};
  for (const key of changedKeys(form, saved)) {
    const [apiKey] = FIELDS[key];
    let value = typeof form[key] === "string" ? form[key].trim() : form[key];
    if ((apiKey === "blood_type" || apiKey === "genotype") && value === "") value = null;
    body[apiKey] = value;
  }
  const result = await authorizedRequest("/api/v1/profile/update", { method: "PUT", body });
  return toForm(result.data);
}

export const deleteAccount = () =>
  authorizedRequest("/api/v1/profile/delete-account", { method: "DELETE", body: { confirmation: "DELETE" } });

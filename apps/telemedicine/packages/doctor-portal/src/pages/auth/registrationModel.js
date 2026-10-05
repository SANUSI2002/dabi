import { toISO } from "../../utils/dateFormat.js";

export const SPECIALTIES = ["General Practice", "Family Medicine", "Internal Medicine", "Pediatrics", "Obstetrics & Gynecology", "Surgery", "Psychiatry", "Dermatology", "Cardiology", "Neurology", "Ophthalmology", "ENT", "Radiology", "Anesthesiology", "Emergency Medicine", "Public Health", "Other"];
export const STATES = ["Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT Abuja", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"];
export const EMPTY_REGISTRATION = { firstName: "", lastName: "", email: "", phone: "", password: "", confirmPassword: "", specialty: "", otherSpecialty: "", qualification: "", otherQualification: "", university: "", graduationYear: "", registrationNumber: "", practiceState: "", city: "", hospital: "", licenceType: "annual", licenceExpiry: "", declaration: false, termsAccepted: false, updatesOptIn: false };
export const DRAFT_KEY = "sabi-doctor-registration-draft-v1";
export function canonicalEmail(email) {
  const value = email.trim();
  const at = value.lastIndexOf("@");
  return at < 0 ? value : value.slice(0, at) + "@" + value.slice(at + 1).toLowerCase();
}
export function passwordError(password) {
  if (password.length < 15) return "Use at least 15 characters. A memorable passphrase works well.";
  if (password.length > 128) return "Use 128 characters or fewer.";
  return "";
}
export function documentError(file, maxBytes = 5 * 1024 * 1024) {
  if (!file) return "Attach this document to continue.";
  if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) return "Choose a PDF, JPG or PNG file.";
  if (file.size === 0 || file.size > maxBytes) return `Choose a file between 1 byte and ${(maxBytes / 1000000).toFixed(1)} MB.`;
  return "";
}
export function validateRegistrationStep(step, values, documents, today = new Date(), requireDocuments = true) {
  const errors = {};
  const require = (key, message) => { if (!String(values[key] ?? "").trim()) errors[key] = message; };
  if (step === 0) {
    require("firstName", "Enter your first name as it appears on your licence.");
    require("lastName", "Enter your last name as it appears on your licence.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "Enter a valid email address.";
    if (!/^\+[1-9]\d{7,14}$/.test(values.phone.replace(/[\s()-]/g, ""))) errors.phone = "Include the country code, for example +2348012345678.";
    const password = passwordError(values.password);
    if (password) errors.password = password;
    if (values.password !== values.confirmPassword || !values.confirmPassword) errors.confirmPassword = "Your passwords must match.";
  }
  if (step === 1) {
    for (const key of ["specialty", "qualification", "university", "registrationNumber", "practiceState", "city"]) require(key, "Complete this field.");
    if (!SPECIALTIES.includes(values.specialty)) errors.specialty = "Select a specialty.";
    if (!STATES.includes(values.practiceState)) errors.practiceState = "Select a state of practice.";
    if (!["MBBS", "MBChB", "MD", "Other medical degree"].includes(values.qualification)) errors.qualification = "Select your qualification.";
    if (values.qualification === "Other medical degree") require("otherQualification", "Enter your medical qualification.");
    if (values.specialty === "Other") require("otherSpecialty", "Enter your specialty.");
    const year = Number(values.graduationYear);
    if (!/^\d{4}$/.test(values.graduationYear) || year < 1940 || year > today.getFullYear()) errors.graduationYear = "Enter a valid graduation year.";
    if (values.registrationNumber.trim().length < 3) errors.registrationNumber = "Enter your MDCN folio / registration number.";
  }
  if (step === 2) {
    if (!["annual", "life"].includes(values.licenceType)) errors.licenceType = "Select your licence type.";
    if (requireDocuments) for (const key of ["licence", "registrationCertificate"]) { const error = documentError(documents[key]); if (error) errors[key] = error; }
    const expiry = new Date(`${values.licenceExpiry}T00:00:00Z`);
    if (values.licenceType === "annual" && (!Number.isFinite(expiry.getTime()) || expiry.toISOString().slice(0, 10) !== values.licenceExpiry || values.licenceExpiry < toISO(today))) errors.licenceExpiry = "Provide the expiry date of your current practising licence.";
  }
  if (step === 3) {
    if (!values.declaration) errors.declaration = "Confirm that your information is accurate.";
    if (!values.termsAccepted) errors.termsAccepted = "Read and accept the registration terms and privacy notice.";
  }
  return errors;
}
export function draftValues(values) {
  return Object.fromEntries(Object.keys(EMPTY_REGISTRATION).filter((key) => !["password", "confirmPassword", "declaration", "termsAccepted"].includes(key)).map((key) => [key, values[key]]));
}
export function loadRegistrationDraft() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY));
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return { ...EMPTY_REGISTRATION };
    const clean = {};
    for (const [key, value] of Object.entries(draftValues(EMPTY_REGISTRATION))) if (typeof saved[key] === typeof value) clean[key] = saved[key];
    return { ...EMPTY_REGISTRATION, ...clean };
  } catch { return { ...EMPTY_REGISTRATION }; }
}
export function registrationPayload(values) {
  const { confirmPassword, otherSpecialty, otherQualification, ...payload } = values;
  return { ...payload, email: canonicalEmail(values.email), phone: values.phone.replace(/[\s()-]/g, ""), specialty: values.specialty === "Other" ? values.otherSpecialty.trim() : values.specialty, qualification: values.qualification === "Other medical degree" ? values.otherQualification.trim() : values.qualification, country: "NG", regulator: "MDCN", consentVersion: "doctor-registration-v1" };
}

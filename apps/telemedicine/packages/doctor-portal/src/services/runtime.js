const configuredBase = String(import.meta.env?.VITE_SABI_IDENTITY_API_URL || "").trim().replace(/\/$/, "");
export const apiBase = configuredBase === "same-origin" ? window.location.origin : configuredBase;
export const AUTH_CONFIGURED = Boolean(apiBase);
// The sample session is available only in an explicit local preview (and Node unit tests).
export const PREVIEW_ENABLED = !import.meta.env || Boolean(import.meta.env.DEV && import.meta.env.MODE === "doctor-preview" && !AUTH_CONFIGURED);
export const REGISTRATION_API_BASE = String(import.meta.env?.VITE_DOCTOR_REGISTRATION_API_URL || "").trim().replace(/\/$/, "");
export const PORTAL_BASE = import.meta.env?.BASE_URL || "/doctor-portal/";
export const PATIENT_SIGN_IN_URL = `${String(import.meta.env?.VITE_SABI_TELEMEDICINE_URL || (import.meta.env?.DEV ? "http://127.0.0.1:5174" : "https://telemedicine.sabihealth.org")).trim().replace(/\/$/, "")}/login`;
export const IDENTITY_UI_URL = String(import.meta.env?.VITE_SABI_IDENTITY_UI_URL || import.meta.env?.VITE_SABI_HEALTH_URL || (import.meta.env?.DEV ? "http://127.0.0.1:5173" : "https://sabihealth.org")).replace(/\/$/, "");

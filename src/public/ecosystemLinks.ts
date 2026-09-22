export const TELEMEDICINE_SIGN_IN_URL =
  import.meta.env.VITE_TELEMEDICINE_SIGN_IN_URL?.trim() ||
  import.meta.env.VITE_TELEMEDICINE_URL?.trim() ||
  (import.meta.env.DEV ? "http://127.0.0.1:5174/login" : "/telemedicine/login");

const emrOrigin = import.meta.env.VITE_SABI_EMR_URL?.trim().replace(/\/$/, "");
const pharmacyOrigin = import.meta.env.VITE_SABI_PHARMACY_URL?.trim().replace(/\/$/, "");

export const EMR_SIGN_IN_URL = emrOrigin ? `${emrOrigin}/login` : "/login";
export const PHARMACY_SIGN_IN_URL = pharmacyOrigin ? `${pharmacyOrigin}/pharmacy/login` : "/pharmacy/login";

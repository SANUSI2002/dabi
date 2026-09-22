const telemedicineOrigin = import.meta.env.VITE_SABI_TELEMEDICINE_URL?.trim().replace(/\/$/, "");
export const SABI_HEALTH_URL = import.meta.env.VITE_SABI_HEALTH_URL?.trim().replace(/\/$/, "") || "/";

export const TELEMEDICINE_SIGN_IN_URL =
  import.meta.env.VITE_TELEMEDICINE_SIGN_IN_URL?.trim() ||
  import.meta.env.VITE_TELEMEDICINE_URL?.trim() ||
  (telemedicineOrigin ? `${telemedicineOrigin}/login` : "") ||
  (import.meta.env.DEV ? "http://127.0.0.1:5174/login" : "/telemedicine/login");

const emrOrigin = import.meta.env.VITE_SABI_EMR_URL?.trim().replace(/\/$/, "");
const pharmacyOrigin = import.meta.env.VITE_SABI_PHARMACY_URL?.trim().replace(/\/$/, "");
const commandCenterOrigin = import.meta.env.VITE_SABI_COMMAND_CENTER_URL?.trim().replace(/\/$/, "");

export const EMR_SIGN_IN_URL = emrOrigin ? `${emrOrigin}/login` : "/emr/login";
export const PHARMACY_SIGN_IN_URL = pharmacyOrigin ? `${pharmacyOrigin}/pharmacy/login` : "/pharmacy/login";
export const COMMAND_CENTER_SIGN_IN_URL = commandCenterOrigin ? `${commandCenterOrigin}/command-center/login` : "/command-center/login";

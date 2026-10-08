const telemedicineOrigin = import.meta.env.VITE_SABI_TELEMEDICINE_URL?.trim().replace(/\/$/, "");
export const SABI_HEALTH_URL = import.meta.env.VITE_SABI_HEALTH_URL?.trim().replace(/\/$/, "") || "/";

export const TELEMEDICINE_SIGN_IN_URL =
  import.meta.env.VITE_TELEMEDICINE_SIGN_IN_URL?.trim() ||
  import.meta.env.VITE_TELEMEDICINE_URL?.trim() ||
  (telemedicineOrigin ? `${telemedicineOrigin}/login` : "") ||
  (import.meta.env.DEV ? "http://127.0.0.1:5174/login" : "/telemedicine/login");

const emrOrigin = import.meta.env.VITE_SABI_EMR_URL?.trim().replace(/\/$/, "");
const doctorOrigin = import.meta.env.VITE_SABI_DOCTOR_URL?.trim().replace(/\/$/, "");
export const DOCTOR_SIGN_IN_URL = doctorOrigin ? `${doctorOrigin}/login` : (import.meta.env.DEV ? "http://127.0.0.1:5175/doctor-portal/login" : "https://doctor.sabihealth.org/login");
export const DOCTOR_REGISTER_URL = DOCTOR_SIGN_IN_URL.replace(/\/login$/, "/register");
const pharmacyOrigin = import.meta.env.VITE_SABI_PHARMACY_URL?.trim().replace(/\/$/, "");
const commandCenterOrigin = import.meta.env.VITE_SABI_COMMAND_CENTER_URL?.trim().replace(/\/$/, "");

export const EMR_SIGN_IN_URL = emrOrigin ? `${emrOrigin}/login` : "/emr/login";
export const PHARMACY_SIGN_IN_URL = pharmacyOrigin ? `${pharmacyOrigin}/pharmacy/login` : "/pharmacy/login";
export const COMMAND_CENTER_SIGN_IN_URL = commandCenterOrigin ? `${commandCenterOrigin}/command-center/login` : "/command-center/login";

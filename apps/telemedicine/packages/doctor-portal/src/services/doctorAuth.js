import { apiBase, REGISTRATION_API_BASE } from "./runtime.js";
import { createDoctorAuthClient } from "./doctorAuthClient.js";
export { AUTH_CONFIGURED, PREVIEW_ENABLED } from "./runtime.js";
export const TERMS_URL = import.meta.env?.VITE_DOCTOR_TERMS_URL || "";
export const PRIVACY_URL = import.meta.env?.VITE_DOCTOR_PRIVACY_URL || "";
export const REGISTRATION_CONFIGURED = Boolean(REGISTRATION_API_BASE && TERMS_URL && PRIVACY_URL);
const auth = createDoctorAuthClient({ base: apiBase });
export const signInDoctor = auth.signIn;
export const verifySignIn = auth.verifySignIn;
export const getAuthenticatedSession = auth.restore;
export const signOutAccount = auth.signOut;
export const requestPasswordReset = auth.requestPasswordReset;
export const doctorRequest = auth.authenticated;

async function registrationRequest(path, options) {
  if (!REGISTRATION_CONFIGURED) throw new Error("Doctor credential submission is not available yet. Existing approved doctors can sign in. Your application has not been submitted.");
  const response = await fetch(REGISTRATION_API_BASE + path, { ...options, credentials: "include", signal: AbortSignal.timeout(30000), headers: { Accept: "application/json", ...options.headers } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || result.message || "Your application could not be submitted. Please try again.");
  return result;
}
export function registerDoctor(payload, documents) {
  const body = new FormData();
  body.append("application", JSON.stringify(payload));
  body.append("licence", documents.licence);
  body.append("registrationCertificate", documents.registrationCertificate);
  return registrationRequest("/doctors/register", { method: "POST", body });
}
export const resendVerification = (email) => registrationRequest("/doctors/resend-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
export const verifyEmail = (token) => registrationRequest("/doctors/verify-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });

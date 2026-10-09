import { apiBase, AUTH_CONFIGURED } from "./runtime.js";
import { createDoctorAuthClient } from "./doctorAuthClient.js";
import { reportSignedInElsewhere } from "../../../shared-portal/sessionWatch.js";
export { AUTH_CONFIGURED, PREVIEW_ENABLED } from "./runtime.js";
export const TERMS_URL = import.meta.env?.VITE_DOCTOR_TERMS_URL || "";
export const PRIVACY_URL = import.meta.env?.VITE_DOCTOR_PRIVACY_URL || "";
export const REGISTRATION_CONFIGURED = AUTH_CONFIGURED;
const auth = createDoctorAuthClient({ base: apiBase, onSignedInElsewhere: () => reportSignedInElsewhere() });
export const checkDoctorSession = auth.checkSession;
export const signInDoctor = auth.signIn;
export const verifySignIn = auth.verifySignIn;
export const getAuthenticatedSession = auth.restore;
export const signOutAccount = auth.signOut;
export const requestPasswordReset = auth.requestPasswordReset;
export const doctorRequest = auth.authenticated;
export const doctorOnboardingRequest = auth.onboarding;
export const getRegistrationConfig = async () => (await auth.publicRequest("/doctors/registration-config")).data;

async function registrationRequest(path, options) {
  if (!REGISTRATION_CONFIGURED) throw new Error("Doctor credential submission is not available yet. Existing approved doctors can sign in. Your application has not been submitted.");
  return auth.publicRequest(path, options);
}
export async function registerDoctor(payload) {
  return (await registrationRequest("/doctors/register", { method: "POST", body: JSON.stringify(payload) })).data;
}
export async function registerProfessional(payload) {
  return (await registrationRequest('/doctors/register-professional', { method: 'POST', body: JSON.stringify(payload) })).data;
}
export const resendVerification = (email) => registrationRequest("/doctors/resend-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
export const verifyEmail = (uid, token) => registrationRequest("/doctors/verify-email", { method: "POST", body: JSON.stringify({ uid, token }) });

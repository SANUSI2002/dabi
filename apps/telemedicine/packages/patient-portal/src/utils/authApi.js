import { confirmPasswordReset, requestPasswordReset as requestReset } from "./sabiIdentity";

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

export const requestPasswordReset = (email) => requestReset(email);

export const resetPassword = (uid, token, password, confirmPassword) =>
  confirmPasswordReset(uid, token, password, confirmPassword);

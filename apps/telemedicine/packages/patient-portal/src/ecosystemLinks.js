export const HOSPITAL_ONBOARDING_URL =
  import.meta.env.VITE_HOSPITAL_ONBOARDING_URL ||
  (import.meta.env.DEV
    ? "http://127.0.0.1:5173/register/organization"
    : "/register/organization");

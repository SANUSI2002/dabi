import { getCurrentDoctor, DEMO_DOCTORS } from "../store/doctorSession.js";
// Existing components read the current session instead of a hard-coded identity.
export const DOCTOR_PROFILE = new Proxy({}, { get: (_, property) => (getCurrentDoctor() || DEMO_DOCTORS[0])[property] });

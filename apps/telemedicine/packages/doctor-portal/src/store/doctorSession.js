import { PREVIEW_ENABLED } from "../services/runtime.js";

export const DEMO_DOCTORS = [
  { id: "doctor-verma", isDemo: true, name: "Dr. Amara Verma", firstNameGreeting: "Dr. Verma", initials: "AV", specialty: "General Practitioner", hospital: "St. Nicholas Hospital", hospitalId: "st-nicholas", email: "amara.verma@sabihealth.com" },
  { id: "doctor-jenkins", isDemo: true, name: "Dr. Sarah Jenkins", firstNameGreeting: "Dr. Jenkins", initials: "SJ", specialty: "Consultant Pediatrician", hospital: "St. Nicholas Hospital", hospitalId: "st-nicholas", email: "sarah.jenkins@sabihealth.com" },
];
export const PRIMARY_DOCTOR_ID = DEMO_DOCTORS[0].id;
const KEY = "sabi-demo-doctor-session";
const listeners = new Set();
function readSession() {
  if (!PREVIEW_ENABLED) return null;
  try { const id = window.sessionStorage?.getItem(KEY); return DEMO_DOCTORS.find((d) => d.id === id) || null; } catch { return null; }
}
let current = readSession();
export function getCurrentDoctor() { return current; }
export function getDoctorId() { return current?.id || "signed-out"; }
export function subscribeToDoctorSession(fn) { listeners.add(fn); return () => listeners.delete(fn); }
// Demo only. Production must obtain this identity from the authenticated server session.
export function selectDemoDoctor(id) {
  if (!PREVIEW_ENABLED) throw new Error("Demo accounts are unavailable on the connected portal");
  const doctor = DEMO_DOCTORS.find((d) => d.id === id);
  if (!doctor) throw new Error("Unknown demo doctor");
  current = doctor;
  try { window.sessionStorage?.setItem(KEY, id); } catch { /* memory-only session */ }
  listeners.forEach((fn) => fn());
}
export function signOutDoctor() {
  current = null;
  try { window.sessionStorage?.setItem(KEY, "signed-out"); } catch { /* memory-only session */ }
  listeners.forEach((fn) => fn());
}

export function activateDoctorSession(doctor) {
  if (!doctor || typeof doctor.id !== "string" || !doctor.id || typeof doctor.name !== "string" || doctor.accountStatus !== "active" || doctor.emailVerified !== true || doctor.licenceVerified !== true) throw new Error("Your doctor account must be verified and approved before accessing the workspace.");
  current = { ...doctor, isDemo: false, initials: doctor.initials || doctor.name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase(), firstNameGreeting: doctor.firstNameGreeting || doctor.name, specialty: doctor.specialty || "Doctor", hospital: doctor.hospital || "Independent practice", hospitalId: doctor.hospitalId || "unaffiliated:" + doctor.id };
  listeners.forEach((fn) => fn());
}

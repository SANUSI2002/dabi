const SAVED_KEY = "sabi-emergency-access-settings";
const DRAFT_KEY = "sabi-emergency-access-draft";

export const EMERGENCY_ACCESS_RECORDS = [
  { key: "appointments", label: "Appointments", description: "Upcoming and recent care visits" },
  { key: "prescriptions", label: "Prescriptions", description: "Current and recent medication orders" },
  { key: "vitals", label: "Vitals", description: "Recent readings and trends" },
  { key: "labResults", label: "Lab Results", description: "Available laboratory reports" },
  { key: "medicalRecords", label: "Medical Records", description: "Clinical records and care history" },
];

const DEFAULT_SETTINGS = Object.fromEntries(EMERGENCY_ACCESS_RECORDS.map(({ key }) => [key, true]));

function readStorage(storage, key, fallback) {
  try {
    const value = storage.getItem(key);
    return value ? { ...fallback, ...JSON.parse(value) } : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function getEmergencyAccessSettings() {
  return readStorage(window.localStorage, SAVED_KEY, DEFAULT_SETTINGS);
}

export function getEmergencyAccessDraft() {
  return readStorage(window.sessionStorage, DRAFT_KEY, getEmergencyAccessSettings());
}

export function saveEmergencyAccessSettings(settings) {
  const saved = writeStorage(window.localStorage, SAVED_KEY, settings);
  if (saved) {
    try {
      window.sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* Keep the draft if session storage is unavailable. */
    }
  }
  return saved;
}

export function saveEmergencyAccessDraft(settings) {
  writeStorage(window.sessionStorage, DRAFT_KEY, settings);
  return settings;
}

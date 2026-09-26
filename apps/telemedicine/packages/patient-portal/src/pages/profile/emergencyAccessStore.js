// Saved choices live on the patient's profile (server vocabulary in `value`); only an unsaved draft is kept in this tab.
const DRAFT_KEY = "sabi-emergency-access-draft";

export const EMERGENCY_ACCESS_RECORDS = [
  { key: "appointments", value: "Appointments", label: "Appointments", description: "Upcoming and recent care visits" },
  { key: "prescriptions", value: "Prescriptions", label: "Prescriptions", description: "Current and recent medication orders" },
  { key: "vitals", value: "Vitals", label: "Vitals", description: "Recent readings and trends" },
  { key: "labResults", value: "Labs", label: "Lab Results", description: "Available laboratory reports" },
  { key: "medicalRecords", value: "Medical Records", label: "Medical Records", description: "Clinical records and care history" },
];

/** Profile values (e.g. ["Labs"]) -> { labResults: true, ... } */
export const toSettings = (values = []) => Object.fromEntries(EMERGENCY_ACCESS_RECORDS.map(({ key, value }) => [key, values.includes(value)]));
export const toValues = (settings) => EMERGENCY_ACCESS_RECORDS.filter(({ key }) => settings[key]).map(({ value }) => value);

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

export function getEmergencyAccessDraft(savedSettings) {
  return readStorage(window.sessionStorage, DRAFT_KEY, savedSettings);
}

export function clearEmergencyAccessDraft() {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* Nothing to clear if session storage is unavailable. */
  }
}

export function saveEmergencyAccessDraft(settings) {
  writeStorage(window.sessionStorage, DRAFT_KEY, settings);
  return settings;
}

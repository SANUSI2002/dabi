import { Heart, Droplet, MonitorCheck, Thermometer, Wind } from "lucide-react";

// The vital types the Sabi API records. `apiType`/`apiUnit` are what the server stores;
// min/max are the slider bounds (kept inside the server's accepted range). `kind: "bp"`
// gets the systolic/diastolic form; "single" gets one slider.
export const VITAL_TYPES = [
  {
    id: "blood-pressure", apiType: "BLOOD_PRESSURE", apiUnit: "mmHg",
    label: "Blood Pressure", icon: MonitorCheck, unit: "mmHg",
    description: "Monitor your systolic and diastolic levels for heart health.",
    kind: "bp",
  },
  {
    id: "heart-rate", apiType: "HEART_RATE", apiUnit: "bpm",
    label: "Heart Rate", icon: Heart, unit: "BPM",
    description: "Track your pulse and resting heart rate.",
    kind: "single", min: 40, max: 180, default: 72, step: 1,
  },
  {
    id: "blood-sugar", apiType: "BLOOD_GLUCOSE", apiUnit: "mg/dL",
    label: "Blood Sugar", icon: Droplet, unit: "mg/dL",
    description: "Log your glucose levels to manage diabetes or insulin sensitivity.",
    kind: "single", min: 60, max: 300, default: 95, step: 1,
  },
  {
    id: "blood-oxygen", apiType: "OXYGEN_SATURATION", apiUnit: "%",
    label: "Blood Oxygen", icon: Wind, unit: "% SpO2",
    description: "Check SpO2 percentages to ensure optimal respiratory function.",
    kind: "single", min: 80, max: 100, default: 98, step: 1,
  },
  {
    id: "body-temperature", apiType: "TEMPERATURE", apiUnit: "C",
    label: "Body Temperature", icon: Thermometer, unit: "°C",
    description: "Record core body temperature for fever or wellness tracking.",
    kind: "single", min: 34, max: 42, default: 36.6, step: 0.1,
  },
];

export function getVitalType(id) {
  return VITAL_TYPES.find((v) => v.id === id) || null;
}

export const vitalTypeForApi = (apiType) => VITAL_TYPES.find((v) => v.apiType === apiType) || null;

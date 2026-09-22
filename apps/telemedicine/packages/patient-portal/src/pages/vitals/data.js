import {
  Activity,
  Heart,
  Droplet,
  MonitorCheck,
  Thermometer,
  Scale,
  Wind,
  Moon,
} from "lucide-react";

// One config entry per vital type, driving the "select type" grid, the
// add-reading form, and the history page. `kind: "bp"` gets the bespoke
// systolic/diastolic dual-slider form (Add Blood Pressure); every other
// kind ("single") gets a generic one-slider form parameterized by
// min/max/step/default — same layout, different numbers.
export const VITAL_TYPES = [
  {
    id: "blood-pressure",
    label: "Blood Pressure",
    icon: MonitorCheck,
    unit: "mmHg",
    description: "Monitor your systolic and diastolic levels for heart health.",
    kind: "bp",
  },
  {
    id: "heart-rate",
    label: "Heart Rate",
    icon: Heart,
    unit: "BPM",
    description: "Track your pulse and resting heart rate variability daily.",
    kind: "single",
    min: 40,
    max: 180,
    default: 72,
    step: 1,
  },
  {
    id: "blood-sugar",
    label: "Blood Sugar",
    icon: Droplet,
    unit: "mg/dL",
    description: "Log your glucose levels to manage diabetes or insulin sensitivity.",
    kind: "single",
    min: 60,
    max: 300,
    default: 95,
    step: 1,
  },
  {
    id: "blood-oxygen",
    label: "Blood Oxygen",
    icon: Wind,
    unit: "% SpO2",
    description: "Check SpO2 percentages to ensure optimal respiratory function.",
    kind: "single",
    min: 80,
    max: 100,
    default: 98,
    step: 1,
  },
  {
    id: "body-temperature",
    label: "Body Temperature",
    icon: Thermometer,
    unit: "°C",
    description: "Record core body temperature for fever or wellness tracking.",
    kind: "single",
    min: 34,
    max: 42,
    default: 36.6,
    step: 0.1,
  },
  {
    id: "weight",
    label: "Weight",
    icon: Scale,
    unit: "kg",
    description: "Stay on top of weight trends and body mass index goals.",
    kind: "single",
    min: 30,
    max: 180,
    default: 70,
    step: 0.1,
  },
  {
    id: "respiratory-rate",
    label: "Respiratory Rate",
    icon: Activity,
    unit: "breaths/min",
    description: "Monitor breaths per minute for clinical recovery and health.",
    kind: "single",
    min: 8,
    max: 40,
    default: 16,
    step: 1,
  },
  {
    id: "sleep",
    label: "Sleep",
    icon: Moon,
    unit: "hours",
    description: "Log sleep duration and quality for restorative mental health.",
    kind: "single",
    min: 0,
    max: 12,
    default: 7.5,
    step: 0.1,
  },
  {
    id: "water-intake",
    label: "Water Intake",
    icon: Droplet,
    unit: "L",
    description: "Track your daily hydration levels in ounces or milliliters.",
    kind: "single",
    min: 0,
    max: 5,
    default: 1.8,
    step: 0.1,
  },
];

export function getVitalType(id) {
  return VITAL_TYPES.find((v) => v.id === id) || VITAL_TYPES[0];
}

// Seed readings so the history page + dashboard aren't empty on first
// load — vitalsStore.js falls back to these the first time each type
// is opened, then persists whatever the person adds after that.
export const SEED_READINGS = {
  "blood-pressure": [
    { id: "bp-1", date: "Oct 14, 2023", time: "09:45 AM", systolic: 118, diastolic: 72, tags: ["Resting"], source: "Apple Health" },
    { id: "bp-2", date: "Oct 12, 2023", time: "08:30 AM", systolic: 142, diastolic: 95, tags: ["Post-Exercise"], source: "Manual" },
    { id: "bp-3", date: "Oct 10, 2023", time: "10:15 PM", systolic: 124, diastolic: 82, tags: ["Evening"], source: "Withings BPM" },
  ],
};

export const VITALS_SUMMARY = [
  { id: "blood-pressure", value: "120/80", status: "Normal" },
  { id: "heart-rate", value: "72", status: "Normal" },
  { id: "blood-oxygen", value: "98", status: "Normal" },
  { id: "blood-sugar", value: "95", status: "Normal" },
  { id: "body-temperature", value: "36.6", status: "Normal" },
  { id: "sleep", value: "7h 20m", status: "Normal" },
  { id: "respiratory-rate", value: "16", status: "Normal" },
  { id: "water-intake", value: "1.8", status: "Normal" },
];

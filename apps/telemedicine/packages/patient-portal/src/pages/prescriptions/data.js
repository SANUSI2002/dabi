// Mock data for the Prescriptions page. Shapes mirror what a real
// /prescriptions API response would look like, so swapping in a
// real fetch later is a drop-in replacement for this file's exports.

export const PRESCRIPTION_STATS = [
  { key: "active", label: "Active Prescriptions", value: "04", icon: "Pill", tone: "primary" },
  { key: "dueToday", label: "Due Today", value: "02", icon: "CalendarClock", tone: "primary" },
  { key: "adherence", label: "Adherence Score", value: "94%", badge: "+2.4%", icon: "BarChart3", tone: "primary" },
  { key: "renewals", label: "Renewals Needed", value: "01", icon: "BellRing", tone: "danger" },
];

export const DAILY_SCHEDULE = [
  {
    key: "morning",
    time: "MORNING (08:00 AM)",
    active: true,
    med: { name: "Lisinopril", detail: "10mg • After Food", status: "actionable" },
  },
  {
    key: "afternoon",
    time: "AFTERNOON (02:00 PM)",
    active: false,
    med: { name: "Vitamin D3", detail: "1000 IU • With lunch", status: "pending" },
  },
  {
    key: "evening",
    time: "EVENING (08:00 PM)",
    active: false,
    med: { name: "Atorvastatin", detail: "20mg • Before bed", status: "pending" },
  },
];

export const PRESCRIPTIONS = [
  {
    id: "rx-1",
    name: "Lisinopril",
    purpose: "For Hypertension Management",
    status: "Active",
    icon: "Pill",
    dosage: "10mg Tablet",
    frequency: "Once Daily",
    prescribed: "Sept 12, 2023",
    fifthLabel: "NEXT REFILL",
    fifthValue: "In 14 Days",
    fifthDanger: false,
    itemCount: 3,
    doctor: { name: "Dr. Aisha Verma", avatar: null },
  },
  {
    id: "rx-2",
    name: "Amoxicillin",
    purpose: "Antibiotic Treatment Course",
    status: "Needs Renewal",
    icon: "Syringe",
    dosage: "500mg Capsule",
    frequency: "3x Daily",
    prescribed: "Oct 20, 2023",
    fifthLabel: "REMAINING",
    fifthValue: "2 Days Left",
    fifthDanger: true,
    itemCount: 1,
    doctor: { name: "Dr. Marcus Thorne", avatar: null },
  },
];

export const ADHERENCE = {
  message: "You've missed 0 doses this week. Keep it up!",
  days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  activeDay: "Sun",
};

export const AI_INSIGHT = {
  quote:
    "Lisinopril works by relaxing blood vessels. Avoid using potassium-based salt substitutes while on this medication.",
  note: "No known drug interactions detected",
};

export const PRESCRIPTION_DETAILS = {
  "rx-1": {
    id: "rx-1",
    name: "Lisinopril 10mg",
    refId: "SB-99201-LV",
    issueDate: "Sept 12, 2023",
    status: "ACTIVE PRESCRIPTION",
    physician: "Dr. Aisha Verma",
    // A single prescription can bundle several medications the doctor
    // prescribed together — this is what gets sent to pharmacies as one
    // order, and each pharmacy quotes back per-item availability/price.
    items: [
      { id: "d1", name: "Lisinopril 10mg", dosage: "1 tablet, once daily", qty: "30 Tablets" },
      { id: "d2", name: "Amlodipine 5mg", dosage: "1 tablet, once daily", qty: "30 Tablets" },
      { id: "d3", name: "Aspirin 75mg", dosage: "1 tablet, once daily", qty: "30 Tablets" },
    ],
    // Mirrors dispense events that will ultimately come from the prescription
    // history API. Item IDs let refill recommendations support multi-item Rx.
    refillHistory: [
      { itemId: "d1", dispensedAt: new Date(Date.now() - 26 * 86400000).toISOString(), supply: "30 Tablets" },
      { itemId: "d2", dispensedAt: new Date(Date.now() - 8 * 86400000).toISOString(), supply: "30 Tablets" },
      { itemId: "d3", dispensedAt: new Date(Date.now() - 29 * 86400000).toISOString(), supply: "30 Tablets" },
    ],
    diagnosis: {
      label: "PRIMARY DIAGNOSIS",
      title: "Stage 1 Essential Hypertension",
      description:
        "A condition where the long-term force of the blood against your artery walls is high enough that it may eventually cause health problems, such as heart disease.",
      target: { label: "BP Target", value: "120/80 mmHg" },
    },
    whyThisMedication: [
      {
        icon: "FlaskConical",
        title: "Mechanism of Action",
        body:
          "Lisinopril belongs to the class of medications called ACE Inhibitors. It works by blocking a substance in the body that causes blood vessels to tighten. As a result, blood vessels relax, which lowers blood pressure and increases the supply of blood and oxygen to the heart.",
        highlight: "ACE Inhibitors",
      },
      {
        icon: "Award",
        title: "Gold Standard Treatment",
        body:
          "Lisinopril is considered a first-line therapy for hypertension due to its extensive clinical track record. It not only lowers blood pressure but also provides significant protective benefits for your kidneys and heart over long-term use.",
      },
    ],
    dosageInstructions: [
      "Take 1 tablet (10mg) once daily.",
      "Can be taken with or without food.",
      "Try to take it at the same time each day (preferably morning).",
    ],
    sideEffects: ["Dry Cough", "Dizziness", "Headache", "Fatigue"],
    sideEffectsNote: "Most side effects are mild and diminish as your body adjusts.",
    criticalInteraction: {
      title: "Avoid Potassium Supplements",
      body:
        "Lisinopril can increase potassium levels. Avoid salt substitutes containing potassium unless directed by Dr. Verma.",
    },
    recoveryForecast: {
      message:
        "Based on your latest vitals and consistent medication adherence, we project a 12% improvement in your cardiovascular efficiency within the next 30 days.",
      adherence: "98%",
      nextSync: "2 days",
    },
    nextDose: "Tomorrow, 08:00 AM",
  },

  "rx-2": {
    id: "rx-2",
    name: "Amoxicillin 500mg",
    refId: "SB-84410-AX",
    issueDate: "Oct 20, 2023",
    status: "NEEDS RENEWAL",
    physician: "Dr. Marcus Thorne",
    items: [
      { id: "d1", name: "Amoxicillin 500mg", dosage: "1 capsule, 3x daily", qty: "21 Capsules" },
    ],
    refillHistory: [
      { itemId: "d1", dispensedAt: new Date(Date.now() - 9 * 86400000).toISOString(), supply: "21 Capsules" },
    ],
    diagnosis: {
      label: "PRIMARY DIAGNOSIS",
      title: "Bacterial Sinus Infection",
      description:
        "An infection of the sinus cavities caused by bacteria, typically treated with a full course of antibiotics to fully clear the infection and prevent recurrence.",
      target: { label: "Course Length", value: "7 Days" },
    },
    whyThisMedication: [
      {
        icon: "FlaskConical",
        title: "Mechanism of Action",
        body:
          "Amoxicillin is a penicillin-type antibiotic that stops bacteria from building the cell walls they need to survive, clearing the infection over the course of treatment.",
        highlight: "Penicillin-class Antibiotic",
      },
    ],
    dosageInstructions: [
      "Take 1 capsule (500mg) three times daily.",
      "Complete the full course even if you feel better early.",
      "Take with a full glass of water.",
    ],
    sideEffects: ["Nausea", "Mild Rash", "Upset Stomach"],
    sideEffectsNote: "Contact your doctor if a rash or swelling develops.",
    criticalInteraction: {
      title: "Complete the Full Course",
      body: "Stopping early can allow the infection to return and become resistant to treatment.",
    },
    recoveryForecast: {
      message: "Most patients see symptoms improve within 48–72 hours of starting the full course.",
      adherence: "82%",
      nextSync: "Today",
    },
    nextDose: "Today, 02:00 PM",
  },
};

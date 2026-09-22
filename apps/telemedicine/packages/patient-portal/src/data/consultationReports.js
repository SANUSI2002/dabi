// Shared "full report" content for a consultation — used by the
// ConsultationReport page (/reports/:id), linked from both the Medical
// Records timeline ("View Full Report") and the Dashboard's Recent
// Consultation list ("view").
//
// Every report shares the same patient block (this demo only has one
// signed-in patient); `PATIENT` is exported separately so a future API
// swap only needs to change one place.

export const PATIENT = {
  name: "John Doe",
  age: 36,
  gender: "Male",
  patientId: "SB-9021",
};

const DEFAULT_REPORT = {
  title: "Consultation Report",
  doctor: "Dr. Elena Richards",
  specialty: "General Practice",
  date: "Oct 14, 2023 · 10:30 AM",
  reason: "Routine check-up requested by the patient, no acute complaints reported.",
  assessment: "No significant findings on examination. Overall health stable.",
  medications: [{ name: "Multivitamin", dosage: "1 tablet daily", duration: "30 days" }],
  lifestyle: ["Maintain a balanced diet", "Continue regular light exercise"],
  testsReferrals: ["No further tests required at this time."],
  followUp: {
    nextAppointment: "As needed",
    warningSigns: ["Any new or worsening symptoms should be reported to your doctor promptly."],
  },
  aiSummary: {
    explanation: "Everything looked normal at this visit — no diagnosis was needed.",
    medicationInstructions: "No new medication was prescribed at this visit.",
    tips: ["Keep up your current routine — it's working."],
  },
};

export const CONSULTATION_REPORTS = {
  "rec-chest-xray": {
    title: "Chest Xray Examination",
    doctor: "Dr. Elena Richards",
    specialty: "General Practice",
    date: "Oct 14, 2023 · Virtual",
    reason: "Follow-up on routine bloodwork flagged mild lipid abnormalities; patient also mentioned occasional fatigue.",
    assessment: "Chest X-ray clear. Bloodwork shows Hyperlipidemia (Mild) and Vitamin D Deficiency, likely contributing to reported fatigue.",
    medications: [{ name: "Vitamin D3", dosage: "2000 IU", duration: "Ongoing daily supplement" }],
    lifestyle: ["Dietary adjustments to reduce saturated fat intake", "30 minutes of light cardio, 4x/week"],
    testsReferrals: ["Repeat lipid panel in 3 months to track progress."],
    followUp: {
      nextAppointment: "Jan 14, 2024 — lipid panel review",
      warningSigns: ["Chest pain, shortness of breath, or severe fatigue should prompt an urgent visit."],
    },
    aiSummary: {
      explanation: "Your cholesterol is a little higher than ideal and your vitamin D is low — both are common and manageable with diet and a daily supplement.",
      medicationInstructions: "Take one Vitamin D3 (2000 IU) tablet each day, ideally with a meal.",
      tips: ["Add more fatty fish, leafy greens, and nuts to your diet.", "A short daily walk can help both your cholesterol and energy levels."],
    },
  },
  "rec-lth-consultation": {
    title: "Hospital Consultation",
    doctor: "Dr. Adaeze Nwosu",
    specialty: "Hospital Consultation · Lagos Teaching Hospital",
    date: "Sep 30, 2023 · Physical",
    reason: "Routine hypertension follow-up, booked through Sabi Health.",
    assessment: "Blood pressure within target range on current medication. No new symptoms reported.",
    medications: [{ name: "Amlodipine", dosage: "5mg", duration: "Once daily, ongoing" }],
    lifestyle: ["Continue low-sodium diet", "Monitor blood pressure at home weekly"],
    testsReferrals: ["Repeat lipid panel in 3 months."],
    followUp: {
      nextAppointment: "Dec 30, 2023 — hypertension review",
      warningSigns: ["Severe headache, blurred vision, or chest pain warrants immediate emergency care."],
    },
    aiSummary: {
      explanation: "Your blood pressure is well controlled right now — the current medication is working.",
      medicationInstructions: "Keep taking Amlodipine 5mg once a day, at the same time each day, even if you feel fine.",
      tips: ["Keep a home blood pressure log to bring to your next visit.", "Limit added salt where you can."],
    },
  },
  "rec-sinusitis": {
    title: "Acute Sinusitis Consultation",
    doctor: "Dr. Marcus Thorne",
    specialty: "General Practice",
    date: "Aug 22, 2023 · Physical",
    reason: "Nasal congestion, facial pressure, and thick discharge for 10 days, worsening despite OTC decongestants.",
    assessment: "Acute bacterial sinusitis secondary to allergic rhinitis.",
    medications: [
      { name: "Amoxicillin-clavulanate", dosage: "875mg", duration: "Twice daily for 7 days" },
      { name: "Nasal corticosteroid spray", dosage: "2 sprays per nostril", duration: "Once daily for 14 days" },
    ],
    lifestyle: ["Stay well hydrated", "Use a saline rinse daily while symptomatic"],
    testsReferrals: ["No imaging needed unless symptoms persist beyond 2 weeks."],
    followUp: {
      nextAppointment: "Only if symptoms persist past 2 weeks",
      warningSigns: ["High fever, facial swelling, or vision changes require urgent care."],
    },
    aiSummary: {
      explanation: "You have a bacterial sinus infection on top of existing allergies — the antibiotic will clear the infection while the nasal spray calms the allergic inflammation.",
      medicationInstructions: "Finish the full course of antibiotics even if you feel better early. Use the nasal spray once daily for 2 weeks.",
      tips: ["A warm compress on the face can ease pressure.", "Avoid known allergy triggers where possible."],
    },
  },
  "blood-panel-oct24": {
    title: "Annual Comprehensive Blood Panel",
    doctor: "Dr. Sarah Jenkins",
    specialty: "Internal Medicine",
    date: "Oct 24, 2023",
    reason: "Annual comprehensive blood panel as part of routine wellness screening.",
    assessment: "All markers within normal range. No abnormalities detected.",
    medications: [],
    lifestyle: ["Maintain current diet and exercise routine"],
    testsReferrals: ["No further tests needed until next annual screening."],
    followUp: {
      nextAppointment: "Oct 2024 — annual panel",
      warningSigns: ["Unexplained weight loss, fatigue, or persistent pain should be reported before the next annual visit."],
    },
    aiSummary: {
      explanation: "Your bloodwork came back completely normal — nothing to worry about.",
      medicationInstructions: "No medication needed based on this result.",
      tips: ["Keep up your annual screening — it's the best way to catch changes early."],
    },
  },
  "ecg-sep12-1": {
    title: "Resting ECG Report",
    doctor: "Dr. Michael Osei",
    specialty: "Cardiology · Metropolitan Heart Center",
    date: "Sep 12, 2023",
    reason: "Routine resting ECG as part of cardiovascular risk screening.",
    assessment: "Normal sinus rhythm. No signs of arrhythmia or ischemia.",
    medications: [],
    lifestyle: ["Continue regular cardiovascular exercise"],
    testsReferrals: ["No further cardiac testing indicated at this time."],
    followUp: {
      nextAppointment: "Next routine screening in 12 months",
      warningSigns: ["Palpitations, chest pain, or fainting should be evaluated urgently."],
    },
    aiSummary: {
      explanation: "Your heart's electrical activity looks completely normal.",
      medicationInstructions: "No medication needed based on this result.",
      tips: ["Keep doing what you're doing for heart health — it's working."],
    },
  },
};

export function getReport(id) {
  return CONSULTATION_REPORTS[id] || DEFAULT_REPORT;
}

// Per-drug reference info used to power the "click a drug to see details"
// experience wherever a prescription bundles more than one medication
// (MedicationsInPrescriptionCard -> DrugDetailModal).
//
// Keyed by the drug's base name (no strength/dosage), lowercased. Lookup is
// done via getDrugInfo(), which strips the strength off whatever label is
// stored on the prescription item (e.g. "Amlodipine 5mg" -> "amlodipine")
// and falls back to a generic-but-still-useful entry for anything not in
// the catalog below, so the modal never renders empty.

const CATALOG = {
  lisinopril: {
    className: "ACE Inhibitor",
    purpose: "Blood pressure management",
    whyThisMedication: [
      {
        icon: "FlaskConical",
        title: "Mechanism of Action",
        body:
          "Lisinopril belongs to the class of medications called ACE Inhibitors. It works by blocking a substance in the body that causes blood vessels to tighten. As a result, blood vessels relax, which lowers blood pressure and increases the supply of blood and oxygen to the heart.",
      },
      {
        icon: "Award",
        title: "Gold Standard Treatment",
        body:
          "Lisinopril is considered a first-line therapy for hypertension due to its extensive clinical track record, and also provides protective benefits for the kidneys and heart over long-term use.",
      },
    ],
    dosageInstructions: [
      "Take 1 tablet once daily.",
      "Can be taken with or without food.",
      "Try to take it at the same time each day (preferably morning).",
    ],
    sideEffects: ["Dry Cough", "Dizziness", "Headache", "Fatigue"],
    sideEffectsNote: "Most side effects are mild and diminish as your body adjusts.",
    criticalInteraction: {
      title: "Avoid Potassium Supplements",
      body: "Lisinopril can increase potassium levels. Avoid salt substitutes containing potassium unless directed by your doctor.",
    },
  },

  amlodipine: {
    className: "Calcium Channel Blocker",
    purpose: "Blood pressure management",
    whyThisMedication: [
      {
        icon: "FlaskConical",
        title: "Mechanism of Action",
        body:
          "Amlodipine relaxes and widens blood vessels by blocking calcium from entering smooth muscle cells, making it easier for the heart to pump blood and lowering blood pressure.",
      },
      {
        icon: "Award",
        title: "Often Paired with an ACE Inhibitor",
        body:
          "It's commonly prescribed alongside medications like Lisinopril for patients who need extra blood pressure control beyond a single agent.",
      },
    ],
    dosageInstructions: [
      "Take 1 tablet once daily, with or without food.",
      "Swallow whole — do not crush or chew.",
      "Rising slowly from sitting/lying down can help with early dizziness.",
    ],
    sideEffects: ["Swollen Ankles/Feet", "Flushing", "Dizziness", "Fatigue"],
    sideEffectsNote: "Ankle swelling is common and usually not dangerous, but mention it at your next visit.",
    criticalInteraction: {
      title: "Grapefruit Caution",
      body: "Grapefruit and grapefruit juice can raise Amlodipine levels in your blood. It's best to avoid them while on this medication.",
    },
  },

  aspirin: {
    className: "Antiplatelet Agent",
    purpose: "Cardiovascular protection",
    whyThisMedication: [
      {
        icon: "FlaskConical",
        title: "Mechanism of Action",
        body:
          "Low-dose Aspirin makes platelets less likely to stick together and form clots, which helps lower the risk of heart attack and stroke in patients with cardiovascular risk factors.",
      },
      {
        icon: "Award",
        title: "Widely Used Preventive Therapy",
        body:
          "It's one of the most studied preventive medications for patients being managed for hypertension or other cardiovascular risk.",
      },
    ],
    dosageInstructions: [
      "Take 1 tablet once daily.",
      "Take with food to reduce stomach irritation.",
      "Do not stop suddenly without speaking to your doctor first.",
    ],
    sideEffects: ["Stomach Upset", "Heartburn", "Easy Bruising"],
    sideEffectsNote: "Report black stools, unusual bruising, or persistent stomach pain to your doctor promptly.",
    criticalInteraction: {
      title: "Bleeding Risk with Other Blood Thinners",
      body: "Combining Aspirin with other blood thinners or NSAIDs (e.g. Ibuprofen) increases bleeding risk. Check with your doctor before combining.",
    },
  },

  amoxicillin: {
    className: "Penicillin-class Antibiotic",
    purpose: "Bacterial infection treatment",
    whyThisMedication: [
      {
        icon: "FlaskConical",
        title: "Mechanism of Action",
        body:
          "Amoxicillin is a penicillin-type antibiotic that stops bacteria from building the cell walls they need to survive, clearing the infection over the course of treatment.",
      },
    ],
    dosageInstructions: [
      "Take 1 capsule three times daily.",
      "Complete the full course even if you feel better early.",
      "Take with a full glass of water.",
    ],
    sideEffects: ["Nausea", "Mild Rash", "Upset Stomach"],
    sideEffectsNote: "Contact your doctor if a rash or swelling develops.",
    criticalInteraction: {
      title: "Complete the Full Course",
      body: "Stopping early can allow the infection to return and become resistant to treatment.",
    },
  },

  atorvastatin: {
    className: "Statin",
    purpose: "Cholesterol management",
    whyThisMedication: [
      {
        icon: "FlaskConical",
        title: "Mechanism of Action",
        body:
          "Atorvastatin blocks an enzyme the liver uses to make cholesterol, lowering LDL ('bad') cholesterol and reducing long-term cardiovascular risk.",
      },
    ],
    dosageInstructions: [
      "Take 1 tablet once daily, preferably in the evening.",
      "Can be taken with or without food.",
      "Avoid excessive alcohol while on this medication.",
    ],
    sideEffects: ["Muscle Aches", "Headache", "Digestive Upset"],
    sideEffectsNote: "Report unexplained muscle pain or weakness to your doctor.",
    criticalInteraction: {
      title: "Grapefruit Caution",
      body: "Grapefruit juice can increase Atorvastatin levels and the risk of side effects.",
    },
  },

  metformin: {
    className: "Biguanide (Antidiabetic)",
    purpose: "Blood sugar management",
    whyThisMedication: [
      {
        icon: "FlaskConical",
        title: "Mechanism of Action",
        body:
          "Metformin lowers blood sugar by reducing how much glucose the liver releases and improving how the body responds to insulin.",
      },
    ],
    dosageInstructions: [
      "Take with meals to reduce stomach upset.",
      "Do not crush extended-release tablets.",
      "Stay hydrated, especially during illness.",
    ],
    sideEffects: ["Nausea", "Diarrhea", "Metallic Taste"],
    sideEffectsNote: "Side effects are usually strongest in the first few weeks and often ease over time.",
    criticalInteraction: {
      title: "Pause Before Contrast Scans",
      body: "Metformin is sometimes paused before procedures using IV contrast dye. Confirm with your doctor if one is scheduled.",
    },
  },

  "vitamin d3": {
    className: "Vitamin Supplement",
    purpose: "Bone & immune support",
    whyThisMedication: [
      {
        icon: "FlaskConical",
        title: "Why It's Recommended",
        body:
          "Vitamin D3 supports calcium absorption for bone health and plays a role in immune function. It's commonly recommended when levels are low or sun exposure is limited.",
      },
    ],
    dosageInstructions: ["Take once daily with a meal containing some fat for better absorption."],
    sideEffects: ["Generally well tolerated at recommended doses"],
    sideEffectsNote: "Very high, prolonged doses can raise calcium levels — stick to the prescribed amount.",
    criticalInteraction: {
      title: "No Major Interactions at Standard Dose",
      body: "Let your doctor know if you're also taking calcium supplements or have kidney disease.",
    },
  },

  paracetamol: {
    className: "Analgesic / Antipyretic",
    purpose: "Pain & fever relief",
    whyThisMedication: [
      {
        icon: "FlaskConical",
        title: "Mechanism of Action",
        body: "Paracetamol reduces pain and fever, though its exact mechanism isn't fully understood — it's thought to act mainly in the brain and spinal cord.",
      },
    ],
    dosageInstructions: ["Take as needed, not exceeding the maximum daily dose on the label.", "Space doses at least 4–6 hours apart."],
    sideEffects: ["Rare at normal doses"],
    sideEffectsNote: "Overdose can seriously damage the liver — never exceed the recommended daily amount.",
    criticalInteraction: {
      title: "Watch Combined Doses",
      body: "Many cold/flu products already contain Paracetamol — check labels to avoid accidentally doubling up.",
    },
  },

  ibuprofen: {
    className: "NSAID",
    purpose: "Pain, inflammation & fever relief",
    whyThisMedication: [
      {
        icon: "FlaskConical",
        title: "Mechanism of Action",
        body: "Ibuprofen blocks enzymes involved in producing prostaglandins, chemicals that drive pain, swelling, and fever.",
      },
    ],
    dosageInstructions: ["Take with food or milk to reduce stomach irritation.", "Use the lowest effective dose for the shortest time needed."],
    sideEffects: ["Stomach Upset", "Heartburn"],
    sideEffectsNote: "Long-term or high-dose use can affect the stomach and kidneys — use only as directed.",
    criticalInteraction: {
      title: "Bleeding Risk with Aspirin/Blood Thinners",
      body: "Combining with Aspirin or other blood thinners increases bleeding risk — check with your doctor first.",
    },
  },

  loratadine: {
    className: "Antihistamine",
    purpose: "Allergy relief",
    whyThisMedication: [
      {
        icon: "FlaskConical",
        title: "Mechanism of Action",
        body: "Loratadine blocks histamine, the chemical responsible for allergy symptoms like sneezing, itching, and a runny nose.",
      },
    ],
    dosageInstructions: ["Take once daily.", "Can be taken with or without food."],
    sideEffects: ["Drowsiness (uncommon)", "Dry Mouth", "Headache"],
    sideEffectsNote: "Non-drowsy for most people, but avoid driving until you know how it affects you.",
    criticalInteraction: {
      title: "Generally Low Interaction Risk",
      body: "Still, mention it to your doctor if you're on other allergy or cold medications.",
    },
  },

  salbutamol: {
    className: "Rescue Inhaler (Bronchodilator)",
    purpose: "Fast asthma symptom relief",
    whyThisMedication: [
      {
        icon: "FlaskConical",
        title: "Mechanism of Action",
        body: "Salbutamol relaxes the muscles around the airways, opening them up quickly during an asthma flare-up or before exercise.",
      },
    ],
    dosageInstructions: ["Use as directed during symptoms — typically 1–2 puffs.", "Keep it within reach at all times.", "Rinse mouth after use."],
    sideEffects: ["Shakiness", "Fast Heartbeat", "Headache"],
    sideEffectsNote: "These usually pass quickly. Seek help if symptoms don't improve after using it.",
    criticalInteraction: {
      title: "Overuse Is a Warning Sign",
      body: "Needing your rescue inhaler often can mean your asthma isn't well controlled — flag this to your doctor.",
    },
  },

  prednisolone: {
    className: "Oral Corticosteroid",
    purpose: "Short-course inflammation control",
    whyThisMedication: [
      {
        icon: "FlaskConical",
        title: "Mechanism of Action",
        body: "Prednisolone reduces inflammation and calms an overactive immune response, often used for short bursts during severe flare-ups.",
      },
    ],
    dosageInstructions: ["Take exactly as directed — do not stop abruptly on longer courses.", "Take with food to protect your stomach."],
    sideEffects: ["Increased Appetite", "Mood Changes", "Trouble Sleeping"],
    sideEffectsNote: "Short courses are usually well tolerated. Longer courses need medical supervision.",
    criticalInteraction: {
      title: "Do Not Stop Suddenly",
      body: "Stopping a longer course abruptly can be unsafe. Always follow your doctor's taper instructions.",
    },
  },

  "vitamin c": {
    className: "Vitamin Supplement",
    purpose: "Immune support",
    whyThisMedication: [
      {
        icon: "FlaskConical",
        title: "Why It's Recommended",
        body: "Vitamin C supports the immune system and helps the body absorb iron from plant-based foods.",
      },
    ],
    dosageInstructions: ["Take once daily, with or without food."],
    sideEffects: ["Stomach Upset (at high doses)"],
    sideEffectsNote: "Generally very well tolerated at recommended doses.",
    criticalInteraction: {
      title: "No Major Interactions at Standard Dose",
      body: "Safe to combine with most other medications.",
    },
  },

  cetirizine: {
    className: "Antihistamine",
    purpose: "Allergy relief",
    whyThisMedication: [
      {
        icon: "FlaskConical",
        title: "Mechanism of Action",
        body: "Cetirizine blocks histamine to relieve sneezing, itching, and other allergy symptoms.",
      },
    ],
    dosageInstructions: ["Take once daily.", "May cause mild drowsiness in some people."],
    sideEffects: ["Drowsiness", "Dry Mouth"],
    sideEffectsNote: "Avoid driving until you know how it affects you.",
    criticalInteraction: {
      title: "Generally Low Interaction Risk",
      body: "Still, mention it to your doctor if you're on other sedating medications.",
    },
  },
};

// Strips a trailing strength/count expression off a drug label, e.g.
// "Amlodipine 5mg" -> "amlodipine", "Loratadine 10mg (24ct)" -> "loratadine".
function baseName(label = "") {
  return label
    .replace(/\(.*?\)/g, "")
    .replace(/\d+(\.\d+)?\s*(mg|mcg|g|ml|iu)\b.*$/i, "")
    .trim()
    .toLowerCase();
}

// Builds a generic-but-still-informative entry for a drug that isn't in the
// catalog above, so the modal is never empty even for unrecognized items.
function genericInfo(name) {
  return {
    className: "Prescribed Medication",
    purpose: "As directed by your doctor",
    whyThisMedication: [
      {
        icon: "FlaskConical",
        title: "Prescribed for Your Treatment",
        body: `${name} was included in this prescription by your doctor as part of your treatment plan. Ask your doctor or pharmacist for more detail on how it works.`,
      },
    ],
    dosageInstructions: ["Take exactly as prescribed by your doctor.", "Do not stop or change the dose without medical advice."],
    sideEffects: ["Varies — ask your pharmacist"],
    sideEffectsNote: "Speak to your pharmacist or doctor about what side effects to watch for with this medication.",
    criticalInteraction: {
      title: "Check for Interactions",
      body: "Tell your doctor or pharmacist about every other medication and supplement you're taking.",
    },
  };
}

export function getDrugInfo(label) {
  const key = baseName(label);
  const match = Object.keys(CATALOG).find((catalogKey) => key === catalogKey || key.startsWith(catalogKey));
  return match ? CATALOG[match] : genericInfo(label);
}

export default getDrugInfo;

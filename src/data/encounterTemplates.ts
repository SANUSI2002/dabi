// Configurable, versioned consultation templates. A template only scaffolds the
// note — it pre-fills prompts into the SOAP fields and suggests orders. It does
// not assert any clinical rule.

export type EncounterTemplate = {
  key: string;
  name: string;
  version: string;
  effectiveDate: string;
  visitType: string;
  /** prompt text pre-filled into each SOAP field */
  soap: { s: string; o: string; a: string; p: string };
  /** lab panel names (from data/catalog LAB_PANELS) commonly ordered */
  suggestedLabs: string[];
  /** clinically relevant negatives worth documenting explicitly */
  pertinentNegatives: string[];
};

export const ENCOUNTER_TEMPLATES: EncounterTemplate[] = [
  {
    key: "general",
    name: "General medicine",
    version: "1.0",
    effectiveDate: "2026-01-01",
    visitType: "General consultation",
    soap: {
      s: "Presenting complaint:\nDuration:\nAssociated symptoms:\nRelevant history:",
      o: "General examination:\nVitals reviewed:\nSystem examination:",
      a: "Working impression:",
      p: "Investigations:\nTreatment:\nSafety-net advice given:\nReview:",
    },
    suggestedLabs: [],
    pertinentNegatives: ["No fever", "No weight loss", "No night sweats", "No blood in stool/urine"],
  },
  {
    key: "chronic",
    name: "Chronic disease review",
    version: "1.2",
    effectiveDate: "2026-01-01",
    visitType: "Chronic disease review",
    soap: {
      s: "Condition(s) under review:\nSymptom control since last visit:\nMedication adherence:\nSide effects:\nHome monitoring readings:",
      o: "BP:\nWeight / BMI:\nRelevant examination (feet, fundi, chest):\nRecent results reviewed:",
      a: "Control status (controlled / uncontrolled) and rationale:",
      p: "Medication changes:\nInvestigations due:\nLifestyle counselling:\nNext review date:",
    },
    suggestedLabs: ["Clinical Chemistry"],
    pertinentNegatives: ["No chest pain", "No visual changes", "No leg swelling", "No hypoglycaemic episodes"],
  },
  {
    key: "maternal",
    name: "Maternal / antenatal",
    version: "1.1",
    effectiveDate: "2026-01-01",
    visitType: "Antenatal review",
    soap: {
      s: "Gestational age:\nFetal movements:\nDanger signs screen (bleeding, headache, blurred vision, reduced movements, fluid loss):\nComplaints:",
      o: "BP:\nWeight:\nSFH:\nPresentation:\nFHR:\nUrinalysis:\nOedema:",
      a: "Risk assessment (low / high risk) and reasons:",
      p: "Investigations:\nSupplements (iron/folate, calcium):\nIPTp / TT status:\nBirth-preparedness discussion:\nNext visit:",
    },
    suggestedLabs: ["Haematology", "Serology"],
    pertinentNegatives: ["No vaginal bleeding", "No headache / blurred vision", "No reduced fetal movements", "No leaking liquor"],
  },
  {
    key: "child",
    name: "Child health (under-5)",
    version: "1.1",
    effectiveDate: "2026-01-01",
    visitType: "Child health consultation",
    soap: {
      s: "Age:\nComplaint and duration:\nFeeding / appetite:\nUrine output:\nIMCI danger signs (unable to drink, vomiting everything, convulsions, lethargy):",
      o: "Weight and plotting (WAZ):\nTemperature:\nRespiratory rate:\nHydration status:\nMUAC:\nChest / ENT examination:",
      a: "IMCI classification / impression:",
      p: "Treatment (ORS/zinc, antibiotic, antimalarial):\nFeeding advice:\nImmunisation catch-up:\nReturn / referral advice:",
    },
    suggestedLabs: ["Parasitology"],
    pertinentNegatives: ["Able to drink / breastfeed", "No vomiting everything", "No convulsions", "Not lethargic / unconscious"],
  },
  {
    key: "followup",
    name: "Follow-up review",
    version: "1.0",
    effectiveDate: "2026-01-01",
    visitType: "Follow-up review",
    soap: {
      s: "Reason for review:\nResponse to previous treatment:\nOutstanding symptoms:\nResults to discuss:",
      o: "Focused examination:\nVitals:",
      a: "Resolved / improving / unchanged / worse — with reason:",
      p: "Continue / change plan:\nFurther investigations:\nDischarge from follow-up or next review:",
    },
    suggestedLabs: [],
    pertinentNegatives: [],
  },
];

export const templateByKey = (key?: string) => ENCOUNTER_TEMPLATES.find((template) => template.key === key);

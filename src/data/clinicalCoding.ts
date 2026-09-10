// FHIR-aligned frontend representation of clinical coding.
//
// This is NOT a conformant terminology service and the codes below are
// illustrative local mappings, not official releases. Where a concept is only
// captured as free text, `system` is "local" and consumers should show it as an
// un-coded label rather than implying it is standardised.

export type CodeSystem =
  | "loinc" // laboratory / observations
  | "snomed" // clinical findings, problems, allergy substances
  | "icd11" // reporting / diagnoses
  | "ucum" // measurement units
  | "rxnorm" // medications
  | "local"; // facility free text — explicitly not standardised

export type CodeableConcept = {
  system: CodeSystem;
  code: string;
  display: string;
  /** the label this facility actually uses on paper, when it differs from `display` */
  localLabel?: string;
  /** code system release the mapping was taken from, when known */
  version?: string;
};

export const CODE_SYSTEM_LABEL: Record<CodeSystem, string> = {
  loinc: "LOINC",
  snomed: "SNOMED CT",
  icd11: "ICD-11",
  ucum: "UCUM",
  rxnorm: "RxNorm",
  local: "Local label",
};

/** true when the concept carries a real standardised code (not facility free text) */
export const isStandardised = (concept: Pick<CodeableConcept, "system" | "code">) =>
  concept.system !== "local" && concept.code.trim().length > 0;

/** wrap a plain string as an explicitly non-standardised local concept */
export const localConcept = (text: string, localLabel?: string): CodeableConcept => ({
  system: "local",
  code: "",
  display: text,
  localLabel,
});

// ---------------------------------------------------------------------------
// Illustrative local mappings — used to attach a code system + code to the
// facility's existing catalogues so the UI can distinguish coded from un-coded.
// ---------------------------------------------------------------------------

/** LOINC-style codes for the common bench tests in data/catalog LAB_TESTS */
export const LAB_LOINC: Record<string, { code: string; display: string }> = {
  "Full Blood Count": { code: "58410-2", display: "CBC panel - Blood by Automated count" },
  "Packed Cell Volume (PCV)": { code: "4544-3", display: "Hematocrit [Volume Fraction] of Blood by Automated count" },
  "Haemoglobin (Hb)": { code: "718-7", display: "Hemoglobin [Mass/volume] in Blood" },
  "White Blood Cell Count": { code: "6690-2", display: "Leukocytes [#/volume] in Blood by Automated count" },
  "Platelet Count": { code: "777-3", display: "Platelets [#/volume] in Blood by Automated count" },
  "Malaria Parasite (MP)": { code: "32700-7", display: "Plasmodium sp identified in Blood by Light microscopy" },
  "Malaria RDT": { code: "70206-9", display: "Plasmodium sp Ag [Presence] in Blood by Rapid immunoassay" },
  "Urinalysis": { code: "24357-6", display: "Urinalysis macro (dipstick) panel in Urine" },
  "Widal Test": { code: "22587-0", display: "Salmonella typhi Ab [Titer] in Serum" },
  "Retroviral Screening (HIV)": { code: "75622-1", display: "HIV 1 and 2 Ab [Presence] in Serum by Rapid immunoassay" },
  "Hepatitis B Surface Antigen": { code: "5196-1", display: "Hepatitis B virus surface Ag [Presence] in Serum" },
  "Hepatitis C Antibody": { code: "16128-1", display: "Hepatitis C virus Ab [Presence] in Serum" },
  "Pregnancy Test (β-HCG)": { code: "2118-8", display: "Choriogonadotropin [Units/volume] in Urine" },
  "Fasting Blood Sugar": { code: "1558-6", display: "Fasting glucose [Mass/volume] in Serum or Plasma" },
  "Random Blood Sugar": { code: "2345-7", display: "Glucose [Mass/volume] in Serum or Plasma" },
  "Serum Electrolytes / Urea / Creatinine": { code: "24326-1", display: "Electrolytes panel - Serum or Plasma" },
  "Liver Function Test": { code: "24325-3", display: "Hepatic function 2000 panel - Serum or Plasma" },
  "Total Cholesterol": { code: "2093-3", display: "Cholesterol [Mass/volume] in Serum or Plasma" },
  "Sputum AFB Microscopy": { code: "11545-1", display: "Mycobacterium sp identified in Sputum by Acid fast stain" },
};

/** LOINC-style codes for recorded vital signs */
export const VITAL_LOINC = {
  bp: { code: "85354-9", display: "Blood pressure panel", unit: "mm[Hg]" },
  temp: { code: "8310-5", display: "Body temperature", unit: "Cel" },
  pulse: { code: "8867-4", display: "Heart rate", unit: "/min" },
  resp: { code: "9279-1", display: "Respiratory rate", unit: "/min" },
  spo2: { code: "59408-5", display: "Oxygen saturation in Arterial blood by Pulse oximetry", unit: "%" },
  weight: { code: "29463-7", display: "Body weight", unit: "kg" },
  height: { code: "8302-2", display: "Body height", unit: "cm" },
  muac: { code: "56072-2", display: "Mid upper arm circumference", unit: "cm" },
  glucose: { code: "2339-0", display: "Glucose [Mass/volume] in Blood", unit: "mmol/L" },
} as const;

export type VitalKey = keyof typeof VITAL_LOINC;

/** SNOMED-style substance codes for allergy recording */
export const ALLERGEN_SNOMED: Record<string, { code: string; display: string }> = {
  Penicillin: { code: "373270004", display: "Penicillin -class of antibiotic- (substance)" },
  Sulfonamides: { code: "51811003", display: "Sulfonamide (substance)" },
  Aspirin: { code: "387458008", display: "Aspirin (substance)" },
  NSAIDs: { code: "372665008", display: "Nonsteroidal anti-inflammatory agent (substance)" },
  Peanut: { code: "256349002", display: "Peanut (substance)" },
  "Iodinated contrast": { code: "111088007", display: "Iodinated contrast media (substance)" },
  Latex: { code: "111088007", display: "Natural rubber latex (substance)" },
  Egg: { code: "102263004", display: "Eggs (edible) (substance)" },
};

/** ICD-11-style codes are already on data/catalog DIAGNOSES; helper to wrap one */
export const icd11Concept = (code: string, name: string): CodeableConcept => ({
  system: "icd11",
  code,
  display: name,
  version: "2024-01",
});

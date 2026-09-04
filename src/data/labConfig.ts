// Per-test lab workflow configuration — settings-driven, edited from
// /laboratory/test-settings. Every test in LAB_TESTS gets one of these,
// either explicitly seeded here or synthesized on the fly by
// useLabConfig.configFor() as a single-phase, single-field default.

export type ResultField = {
  id: string;
  label: string;
  unit?: string;
  refRange?: string;
  type: "text" | "number" | "select";
  options?: string[];
};

export type LabTestConfig = {
  testName: string;
  phases: string[]; // ordered; always ends in an approval sign-off, on top of these
  turnaroundMinutes: number;
  resultTemplate: ResultField[];
};

const rf = (label: string, unit?: string, refRange?: string): ResultField => ({
  id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  label,
  unit,
  refRange,
  type: "text",
});

export const LAB_TEST_CONFIGS: LabTestConfig[] = [
  {
    testName: "Full Blood Count",
    phases: ["Sample processing", "Cell counting", "Differential count", "Scientist verification"],
    turnaroundMinutes: 60,
    resultTemplate: [
      rf("Haemoglobin (Hb)", "g/dL", "11–16"),
      rf("Packed Cell Volume", "%", "36–48"),
      rf("White Blood Cell Count", "x10⁹/L", "4–11"),
      rf("Platelet Count", "x10⁹/L", "150–400"),
      rf("Differential", "", "Neutrophils/Lymphocytes/Monocytes/Eosinophils/Basophils"),
    ],
  },
  {
    testName: "Malaria RDT",
    phases: ["Testing"],
    turnaroundMinutes: 15,
    resultTemplate: [rf("Result", "", "Negative")],
  },
  {
    testName: "Malaria Parasite (MP)",
    phases: ["Smear preparation", "Microscopy"],
    turnaroundMinutes: 30,
    resultTemplate: [rf("Parasite seen", "", "Not seen"), rf("Species", "", "—"), rf("Parasite density", "/µL", "—")],
  },
  {
    testName: "Widal Test",
    phases: ["Incubation", "Titre reading"],
    turnaroundMinutes: 60,
    resultTemplate: [rf("O antigen titre", "titre", "< 1:80"), rf("H antigen titre", "titre", "< 1:80")],
  },
  {
    testName: "Urinalysis",
    phases: ["Dipstick analysis", "Microscopy"],
    turnaroundMinutes: 20,
    resultTemplate: [rf("Protein"), rf("Glucose"), rf("Leucocytes"), rf("Nitrites"), rf("Microscopy (cells/casts)")],
  },
  {
    testName: "Retroviral Screening (HIV)",
    phases: ["Screening test", "Confirmatory test"],
    turnaroundMinutes: 30,
    resultTemplate: [rf("Screening result", "", "Non-reactive"), rf("Confirmatory result", "", "Non-reactive")],
  },
  {
    testName: "Serum Electrolytes / Urea / Creatinine",
    phases: ["Sample analysis", "Scientist verification"],
    turnaroundMinutes: 120,
    resultTemplate: [rf("Sodium", "mmol/L", "135–145"), rf("Potassium", "mmol/L", "3.5–5.1"), rf("Urea", "mmol/L", "2.5–7.1"), rf("Creatinine", "µmol/L", "53–106")],
  },
  {
    testName: "Liver Function Test",
    phases: ["Sample analysis", "Scientist verification"],
    turnaroundMinutes: 120,
    resultTemplate: [rf("ALT", "U/L", "7–56"), rf("AST", "U/L", "10–40"), rf("Total Bilirubin", "µmol/L", "3–17"), rf("Albumin", "g/L", "35–50")],
  },
];

export function defaultConfigFor(testName: string, turnaroundMinutes: number): LabTestConfig {
  return {
    testName,
    phases: ["Analysis"],
    turnaroundMinutes,
    resultTemplate: [rf("Result"), rf("Notes")],
  };
}

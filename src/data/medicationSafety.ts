import type { AllergyIntolerance } from "./clinical";

// Frontend medication-safety screening. These are simple name-based heuristics,
// not a drug knowledge base — the interface must not imply clinical validation.

export type SafetyAlert = {
  kind: "allergy" | "duplicate" | "stock" | "controlled";
  severity: "high" | "moderate" | "info";
  message: string;
};

/** rough allergen-family expansion so "Amoxicillin" trips a "Penicillin" allergy */
const ALLERGEN_FAMILIES: Record<string, string[]> = {
  penicillin: ["penicillin", "amoxicillin", "ampicillin", "augmentin", "cloxacillin", "flucloxacillin", "piperacillin"],
  sulfonamide: ["sulfa", "sulfonamide", "cotrimoxazole", "septrin", "sulfamethoxazole", "sulfadoxine"],
  nsaid: ["nsaid", "ibuprofen", "diclofenac", "naproxen", "aspirin", "indomethacin", "piroxicam"],
  aspirin: ["aspirin", "acetylsalicylic"],
  cephalosporin: ["cephalexin", "cefuroxime", "ceftriaxone", "cefixime", "cephalosporin"],
};

function drugMatchesAllergen(drugName: string, allergen: string): boolean {
  const drug = drugName.toLowerCase();
  const substance = allergen.toLowerCase().trim();
  if (!substance) return false;
  if (drug.includes(substance)) return true;
  const family = ALLERGEN_FAMILIES[substance] ?? Object.values(ALLERGEN_FAMILIES).find((names) => names.includes(substance));
  return Boolean(family && family.some((name) => drug.includes(name)));
}

export function screenPrescription(input: {
  drugName: string;
  allergies: AllergyIntolerance[];
  activePrescriptions: { drug: string; status: string }[];
  stockOnHand?: number;
}): SafetyAlert[] {
  const alerts: SafetyAlert[] = [];
  const drug = input.drugName.trim();
  if (!drug) return alerts;

  for (const allergy of input.allergies) {
    if (allergy.clinicalStatus !== "active") continue;
    if (drugMatchesAllergen(drug, allergy.substance.display)) {
      alerts.push({
        kind: "allergy",
        severity: allergy.criticality === "high" ? "high" : "moderate",
        message: `Patient has a recorded ${allergy.type} to ${allergy.substance.display} (${allergy.verificationStatus}).`,
      });
    }
  }

  const genericName = drug.split(/\s|\d/)[0].toLowerCase();
  const duplicate = input.activePrescriptions.find(
    (prescription) =>
      (prescription.status === "Dispensed" || prescription.status === "Partially Dispensed") &&
      prescription.drug.toLowerCase().includes(genericName) &&
      prescription.drug.toLowerCase() !== drug.toLowerCase(),
  );
  if (duplicate) {
    alerts.push({
      kind: "duplicate",
      severity: "moderate",
      message: `A similar medication was recently dispensed: ${duplicate.drug}. Check for duplicate therapy.`,
    });
  }

  if (input.stockOnHand !== undefined && input.stockOnHand <= 0) {
    alerts.push({ kind: "stock", severity: "info", message: "This item is out of stock on the pharmacy catalogue." });
  }

  return alerts;
}

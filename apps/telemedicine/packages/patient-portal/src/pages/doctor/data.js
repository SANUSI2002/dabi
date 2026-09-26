import { HeartPulse, Leaf, Smile, Stethoscope } from "lucide-react";

// Featured specialties shown on Find Your Doctor. Counts are computed from the live directory.
export const SPECIALTIES = [
  { label: "General Practice", icon: Stethoscope, aliases: ["general practice", "general practitioner", "family medicine"] },
  { label: "Cardiology", icon: HeartPulse, aliases: ["cardiology", "cardiologist"] },
  { label: "Pediatrics", icon: Smile, aliases: ["pediatrics", "paediatrics", "pediatrician", "paediatrician"] },
  { label: "Neurology", icon: Leaf, aliases: ["neurology", "neurologist"] },
];

/** Doctors' specialties are free text, so match on common spellings. */
export const inSpecialty = (doctor, label) => {
  const spec = SPECIALTIES.find((s) => s.label === label);
  const value = (doctor.specialty || "").trim().toLowerCase();
  return spec ? spec.aliases.includes(value) : value === label.toLowerCase();
};

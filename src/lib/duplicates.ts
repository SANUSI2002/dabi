import type { Patient } from "@/data/types";

// Likely-duplicate scoring shared by the demo registry and the live registry, so staff see the
// same reasons and the same "this looks like an existing patient" threshold in both.

export type DuplicateCandidate = { firstName: string; lastName: string; dob?: string; phone?: string; nin?: string };
export type DuplicateMatch = { patient: Patient; reasons: string[]; score: number };

/** A score of 5 or more is a strong match: registration asks staff to confirm it is a different person. */
export const STRONG_DUPLICATE_SCORE = 5;

const normalise = (value?: string) => (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function scoreDuplicate(candidate: DuplicateCandidate, existing: Patient): DuplicateMatch {
  const candidateName = normalise(`${candidate.firstName}${candidate.lastName}`);
  const candidatePhone = normalise(candidate.phone);
  const candidateNin = normalise(candidate.nin);
  const reasons: string[] = [];
  let score = 0;
  if (candidateNin && normalise(existing.nin) === candidateNin) { reasons.push("Same NIN"); score += 5; }
  if (candidatePhone && candidatePhone.length >= 7 && normalise(existing.phone) === candidatePhone) { reasons.push("Same phone number"); score += 3; }
  const sameName = candidateName && normalise(`${existing.firstName}${existing.lastName}`) === candidateName;
  const sameDob = candidate.dob && existing.dob.slice(0, 10) === candidate.dob.slice(0, 10);
  if (sameName && sameDob) { reasons.push("Same name and date of birth"); score += 5; }
  else if (sameName) { reasons.push("Same name"); score += 2; }
  else if (sameDob && candidateName && normalise(existing.lastName) === normalise(candidate.lastName)) { reasons.push("Same surname and date of birth"); score += 2; }
  return { patient: existing, reasons, score };
}

/** Matches worth showing (score ≥ 2), strongest first. */
export const rankDuplicates = (candidate: DuplicateCandidate, patients: Patient[]) =>
  patients.map((existing) => scoreDuplicate(candidate, existing)).filter((match) => match.score >= 2).sort((left, right) => right.score - left.score);

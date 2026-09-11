// Frontend nursing data — inpatient flowsheet observations and a medication
// administration record (MAR). In-memory, matching the useEmr clinical spine.

export type NursingObservation = {
  id: string;
  admissionId: string;
  patientId: string;
  recordedAt: string;
  recordedBy: string;
  temp?: number;
  pulse?: number;
  resp?: number;
  bp?: string;
  spo2?: number;
  painScore?: number; // 0-10
  intakeMl?: number;
  outputMl?: number;
  mobility?: string;
  fallsRisk?: "Low" | "Moderate" | "High";
  pressureRisk?: "Low" | "Moderate" | "High";
  note?: string;
};

export type AdministrationStatus = "scheduled" | "due" | "given" | "held" | "refused" | "omitted";

export type MedicationAdministration = {
  id: string;
  slotKey: string; // prescriptionId:day:time — identifies the scheduled dose
  admissionId: string;
  patientId: string;
  prescriptionId: string;
  drug: string;
  dose: string;
  route: string;
  scheduledFor: string;
  status: AdministrationStatus;
  administeredBy?: string;
  administeredAt?: string;
  reason?: string;
};

export const MOBILITY_OPTIONS = ["Independent", "Supervised", "Assistance of 1", "Assistance of 2", "Hoist", "Bed-bound"];
export const RISK_LEVELS: NursingObservation["fallsRisk"][] = ["Low", "Moderate", "High"];

/** map a prescription frequency abbreviation to administration times */
export function frequencyToTimes(frequency: string): string[] {
  const value = frequency.trim().toLowerCase().replace(/\./g, "");
  const map: Record<string, string[]> = {
    od: ["08:00"], daily: ["08:00"], mane: ["08:00"],
    bd: ["08:00", "20:00"], bid: ["08:00", "20:00"],
    tds: ["08:00", "14:00", "20:00"], tid: ["08:00", "14:00", "20:00"],
    qds: ["06:00", "12:00", "18:00", "22:00"], qid: ["06:00", "12:00", "18:00", "22:00"],
    nocte: ["22:00"], on: ["22:00"],
    "q6h": ["00:00", "06:00", "12:00", "18:00"], "q8h": ["06:00", "14:00", "22:00"], "q12h": ["08:00", "20:00"],
  };
  if (map[value]) return map[value];
  if (/prn|as needed|sos/.test(value)) return []; // as-required, not scheduled
  return ["08:00"];
}

/** parse a duration string ("5 days", "3/7", "1 week", "2/52") to a day count */
export function durationToDays(duration: string): number {
  const text = duration.trim().toLowerCase();
  const slashWeek = text.match(/(\d+)\s*\/\s*52/);
  if (slashWeek) return Number(slashWeek[1]) * 7;
  const slashDay = text.match(/(\d+)\s*\/\s*7/);
  if (slashDay) return Number(slashDay[1]);
  const weeks = text.match(/(\d+)\s*week/);
  if (weeks) return Number(weeks[1]) * 7;
  const days = text.match(/(\d+)/);
  if (days) return Math.min(14, Number(days[1]));
  return 3;
}

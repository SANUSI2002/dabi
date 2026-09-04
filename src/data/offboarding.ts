// Exit workflow — a fixed stage pipeline every offboarding case walks through.
// Reaching the final (Archived) stage deactivates the employee record.

export type OffboardingStageType = "Notice Period" | "Exit Interview" | "Work Handover" | "FNF Settlement" | "Farewell" | "Archived";

export type OffboardingStage = {
  id: string;
  title: string;
  type: OffboardingStageType;
  sequence: number;
  isFinal: boolean;
};

export const EXIT_REASONS = [
  "Resignation — better opportunity", "Resignation — relocation", "Resignation — personal reasons",
  "End of contract", "Termination — performance", "Termination — conduct", "Retirement",
];

export type OffboardingCase = {
  id: string;
  employeeId: string;
  reason: string;
  noticeDate: string;
  lastWorkingDate: string;
  currentStageId: string;
  status: "Ongoing" | "Completed";
  exitInterviewNotes?: string;
  handoverNotes?: string;
  fnfAmount?: number;
  fnfSettled: boolean;
  createdAt: string;
  completedAt?: string;
};

export const stages: OffboardingStage[] = [
  { id: "ofb-st0", title: "Notice Period", type: "Notice Period", sequence: 0, isFinal: false },
  { id: "ofb-st1", title: "Exit Interview", type: "Exit Interview", sequence: 1, isFinal: false },
  { id: "ofb-st2", title: "Work Handover", type: "Work Handover", sequence: 2, isFinal: false },
  { id: "ofb-st3", title: "FNF Settlement", type: "FNF Settlement", sequence: 3, isFinal: false },
  { id: "ofb-st4", title: "Farewell", type: "Farewell", sequence: 4, isFinal: false },
  { id: "ofb-st5", title: "Archived", type: "Archived", sequence: 5, isFinal: true },
];

const day = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

export const cases: OffboardingCase[] = [
  {
    id: "ofb1", employeeId: "s5", reason: "End of contract", noticeDate: day(5), lastWorkingDate: day(-25),
    currentStageId: "ofb-st0", status: "Ongoing", fnfSettled: false, createdAt: day(5),
  },
];

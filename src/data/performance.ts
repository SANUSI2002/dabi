// Performance management — review periods, OKR objectives/key-results, 360 feedback, 1-on-1 meetings.

const day = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

export type ReviewPeriod = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

export type KeyResultType = "Numeric" | "Percentage" | "Boolean";
export type KeyResult = {
  id: string;
  title: string;
  type: KeyResultType;
  targetValue: number;
};

export type DurationUnit = "Days" | "Months" | "Years";
export type Objective = {
  id: string;
  title: string;
  description: string;
  managerIds: string[];
  assigneeIds: string[];
  keyResultIds: string[];
  durationUnit: DurationUnit;
  duration: number;
};

export type ObjectiveStatus = "Not Started" | "On Track" | "Behind" | "At Risk" | "Closed";

export type EmployeeKeyResult = {
  id: string;
  keyResultId: string;
  title: string;
  type: KeyResultType;
  currentValue: number;
  targetValue: number;
};

export type EmployeeObjective = {
  id: string;
  objectiveId: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  status: ObjectiveStatus;
  progressPercentage: number;
  keyResults: EmployeeKeyResult[];
};

export const FEEDBACK_QUESTIONS = [
  "Meets clinical / role competency standards",
  "Communicates effectively with the team and patients",
  "Reliable — attendance, punctuality, follow-through",
  "Supports colleagues and shares knowledge",
];

export type FeedbackAnswer = { question: string; rating: number; comment?: string };
export type FeedbackStatus = "Not Started" | "In Progress" | "Closed";
export type Feedback = {
  id: string;
  reviewCycle: string;
  employeeId: string;
  managerId?: string;
  colleagueIds: string[];
  status: FeedbackStatus;
  startDate: string;
  endDate?: string;
  selfAnswers?: FeedbackAnswer[];
  managerAnswers?: FeedbackAnswer[];
};

export type MeetingStatus = "Scheduled" | "Completed";
export type Meeting = {
  id: string;
  title: string;
  employeeId: string;
  managerId: string;
  scheduledAt: string;
  status: MeetingStatus;
  notes?: string;
  actionItems?: string;
};

export const periods: ReviewPeriod[] = [
  { id: "pr1", name: "Q3 2026", startDate: day(65), endDate: day(-25) },
];

export const keyResults: KeyResult[] = [
  { id: "kr1", title: "ANC clients counselled on FP", type: "Numeric", targetValue: 40 },
  { id: "kr2", title: "Zero missed-checkout attendance incidents", type: "Boolean", targetValue: 1 },
  { id: "kr3", title: "NHMIS monthly return submitted on time", type: "Percentage", targetValue: 100 },
];

export const objectives: Objective[] = [
  { id: "ob1", title: "Improve postpartum family-planning uptake", description: "Increase PNC clients accepting a modern FP method before discharge.", managerIds: ["s1"], assigneeIds: ["s2", "s3"], keyResultIds: ["kr1"], durationUnit: "Months", duration: 3 },
  { id: "ob2", title: "Attendance discipline", description: "Zero unexplained lateness or missed checkouts this quarter.", managerIds: ["s1"], assigneeIds: ["s2", "s6"], keyResultIds: ["kr2"], durationUnit: "Months", duration: 3 },
];

export const employeeObjectives: EmployeeObjective[] = [
  { id: "eo1", objectiveId: "ob1", employeeId: "s2", startDate: day(65), endDate: day(-25), status: "On Track", progressPercentage: 55, keyResults: [{ id: "ekr1", keyResultId: "kr1", title: "ANC clients counselled on FP", type: "Numeric", currentValue: 22, targetValue: 40 }] },
  { id: "eo2", objectiveId: "ob1", employeeId: "s3", startDate: day(65), endDate: day(-25), status: "Behind", progressPercentage: 20, keyResults: [{ id: "ekr2", keyResultId: "kr1", title: "ANC clients counselled on FP", type: "Numeric", currentValue: 8, targetValue: 40 }] },
  { id: "eo3", objectiveId: "ob2", employeeId: "s2", startDate: day(65), endDate: day(-25), status: "On Track", progressPercentage: 100, keyResults: [{ id: "ekr3", keyResultId: "kr2", title: "Zero missed-checkout attendance incidents", type: "Boolean", currentValue: 1, targetValue: 1 }] },
];

export const feedbacks: Feedback[] = [
  { id: "fb1", reviewCycle: "Q3 2026", employeeId: "s3", managerId: "s2", colleagueIds: ["s7"], status: "In Progress", startDate: day(20) },
];

export const meetings: Meeting[] = [
  { id: "mt1", title: "Monthly 1-on-1", employeeId: "s6", managerId: "s1", scheduledAt: day(-3), status: "Scheduled" },
];

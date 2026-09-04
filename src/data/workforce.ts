// WBiz V3 — Timesheet, Attendance & Workforce Scheduling
// Types + seed data for the Workforce submodule.

export type Classification = "Working" | "Off" | "On-call" | "Flexible";
export type CaptureMode = "Attendance" | "Manual" | "Hybrid";
export type WeekDay = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
export const WEEKDAYS: WeekDay[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type TimeBlock = {
  id: string;
  name: string;
  code: string;
  start: string; // HH:mm
  end: string;
  overnight: boolean;
  paidHours: number;
  breakMins: number;
  lateGraceMins: number;
  classification: Classification;
  colour: string;
  active: boolean;
};

export type WeeklySchedule = {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  days: Record<WeekDay, string | "Off">; // timeBlock id or "Off"
  rotation?: string[]; // ordered block ids / "Off" for rotational
  rotationLength?: number;
  status: "Active" | "Draft" | "Retired";
};

export type ScheduleAssignment = {
  id: string;
  staffId: string;
  scheduleId: string;
  effectiveFrom: string;
  effectiveTo?: string;
  captureMode: CaptureMode;
};

export type AttendanceInterval = {
  id: string;
  staffId: string;
  date: string;
  clockIn: string; // HH:mm
  clockOut?: string;
  source: "Web" | "Mobile" | "Kiosk" | "Manual";
  breakMins: number;
  flags: string[]; // e.g. "Late", "Auto-checkout", "Missing checkout", "Overnight"
  location?: string;
};

export type TimesheetLineSource = "Attendance" | "Manual";
export type TimesheetLine = {
  id: string;
  date: string;
  source: TimesheetLineSource;
  expectedHours: number;
  workedHours: number;
  breakHours: number;
  overtimeHours: number;
  container?: string;
  task?: string;
  note?: string;
};

export type TimesheetStatus = "Open" | "Submitted" | "Approved" | "Locked" | "Rejected";
export type Timesheet = {
  id: string;
  staffId: string;
  periodId: string;
  status: TimesheetStatus;
  lines: TimesheetLine[];
  submittedAt?: string;
  approvedAt?: string;
  approver?: string;
  captureMode: CaptureMode;
};

export type TimesheetPeriod = {
  id: string;
  label: string;
  start: string;
  end: string;
  locked: boolean;
};

export type TimePolicy = {
  id: string;
  scope: string;
  effectiveFrom: string;
  effectiveTo?: string;
  periodType: "Weekly" | "Bi-weekly" | "Monthly";
  captureDefault: CaptureMode;
  incrementMins: number;
  rounding: "None" | "Nearest 5" | "Nearest 15";
  submissionDeadlineDays: number;
  approvalDeadlineDays: number;
  lateGraceMins: number;
  earlyLeaveGraceMins: number;
  absenceThresholdMins: number;
  maxDailyHours: number;
  allowEditDerived: boolean;
  overtimeEnabled: boolean;
  status: "Current" | "Future" | "Expired";
};

export type Enrolment = {
  id: string;
  selector: string; // "Employee: Grace" or "Department: Nursing"
  captureMode: CaptureMode;
  effectiveFrom: string;
  count: number;
  resolvedPolicy: string;
};

export type WorkContainer = {
  id: string;
  label: string; // configurable term instance e.g. "Programme", "Initiative"
  name: string;
  code: string;
  owner: string;
  status: "Active" | "Closed";
};

export type WorkTask = {
  id: string;
  containerId: string;
  name: string;
  parentId?: string;
  assignedTo: string; // staff name or "Nursing team"
  status: "Not started" | "In progress" | "Blocked" | "Done";
  estimateHours: number;
  loggedHours: number;
};

export type WorkActivity = {
  id: string;
  taskId: string;
  staff: string;
  date: string;
  hours: number;
  note: string;
};

export type Holiday = {
  id: string;
  name: string;
  date: string;
  scope: "Organisation" | "Location" | "Group" | "Schedule";
  scopeValue: string;
  paid: boolean;
  workRequiresApproval: boolean;
};

export type LeaveRequest = {
  id: string;
  staffId: string;
  type: "Annual" | "Sick" | "Maternity" | "Compassionate" | "Study" | "Unpaid";
  from: string;
  to: string;
  days: number;
  status: "Pending" | "Approved" | "Rejected";
  paid: boolean;
  note?: string;
};

export type HolidayWorkRequest = {
  id: string;
  staffId: string;
  holidayId: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  hours: number;
};

/* ------------------------------------------------------------------ seed */

const iso = (d: number) => {
  const x = new Date();
  x.setDate(x.getDate() - d);
  x.setHours(8, 0, 0, 0);
  return x.toISOString();
};
const day = (d: number) => iso(d).slice(0, 10);

export const timeBlocks: TimeBlock[] = [
  { id: "tb1", name: "Day Shift", code: "DAY", start: "08:00", end: "16:00", overnight: false, paidHours: 7.5, breakMins: 30, lateGraceMins: 10, classification: "Working", colour: "#0fc06d", active: true },
  { id: "tb2", name: "Late Shift", code: "LATE", start: "14:00", end: "22:00", overnight: false, paidHours: 7.5, breakMins: 30, lateGraceMins: 10, classification: "Working", colour: "#2fdd8a", active: true },
  { id: "tb3", name: "Night Shift", code: "NIGHT", start: "22:00", end: "06:00", overnight: true, paidHours: 7.5, breakMins: 30, lateGraceMins: 15, classification: "Working", colour: "#0a4f32", active: true },
  { id: "tb4", name: "On-call", code: "ONCALL", start: "16:00", end: "08:00", overnight: true, paidHours: 2, breakMins: 0, lateGraceMins: 0, classification: "On-call", colour: "#f59e0b", active: true },
  { id: "tb5", name: "Rest Day", code: "OFF", start: "00:00", end: "00:00", overnight: false, paidHours: 0, breakMins: 0, lateGraceMins: 0, classification: "Off", colour: "#b0d6bf", active: true },
];

export const schedules: WeeklySchedule[] = [
  {
    id: "sc1", name: "Standard Clinic Week", description: "Mon–Fri day shift, weekend off", startDate: day(120),
    days: { Mon: "tb1", Tue: "tb1", Wed: "tb1", Thu: "tb1", Fri: "tb1", Sat: "Off", Sun: "Off" }, status: "Active",
  },
  {
    id: "sc2", name: "6-Day Front Desk", description: "Mon–Sat day shift", startDate: day(120),
    days: { Mon: "tb1", Tue: "tb1", Wed: "tb1", Thu: "tb1", Fri: "tb1", Sat: "tb1", Sun: "Off" }, status: "Active",
  },
  {
    id: "sc3", name: "Maternity 3-Week Rotation", description: "Day → Late → Night rotating", startDate: day(90),
    days: { Mon: "tb1", Tue: "tb1", Wed: "tb1", Thu: "tb1", Fri: "tb1", Sat: "Off", Sun: "Off" },
    rotation: ["tb1", "tb1", "tb1", "tb1", "tb1", "Off", "Off", "tb2", "tb2", "tb2", "tb2", "tb2", "Off", "Off", "tb3", "tb3", "tb3", "tb3", "tb3", "Off", "Off"],
    rotationLength: 21, status: "Active",
  },
];

export const assignments: ScheduleAssignment[] = [
  { id: "as1", staffId: "s1", scheduleId: "sc1", effectiveFrom: day(90), captureMode: "Hybrid" },
  { id: "as2", staffId: "s2", scheduleId: "sc3", effectiveFrom: day(60), captureMode: "Attendance" },
  { id: "as3", staffId: "s3", scheduleId: "sc3", effectiveFrom: day(60), captureMode: "Attendance" },
  { id: "as4", staffId: "s4", scheduleId: "sc1", effectiveFrom: day(90), captureMode: "Manual" },
  { id: "as5", staffId: "s7", scheduleId: "sc1", effectiveFrom: day(90), captureMode: "Attendance" },
  { id: "as6", staffId: "s8", scheduleId: "sc2", effectiveFrom: day(90), captureMode: "Attendance" },
];

export const attendanceIntervals: AttendanceInterval[] = [
  { id: "ai1", staffId: "s2", date: day(1), clockIn: "07:58", clockOut: "16:12", source: "Mobile", breakMins: 35, flags: [], location: "Sabi Health Post" },
  { id: "ai2", staffId: "s3", date: day(1), clockIn: "08:22", clockOut: "16:05", source: "Kiosk", breakMins: 30, flags: ["Late"], location: "Sabi Health Post" },
  { id: "ai3", staffId: "s7", date: day(1), clockIn: "08:01", clockOut: undefined, source: "Web", breakMins: 0, flags: ["Missing checkout"], location: "Sabi Health Post" },
  { id: "ai4", staffId: "s8", date: day(1), clockIn: "07:45", clockOut: "17:40", source: "Kiosk", breakMins: 45, flags: ["Overtime"], location: "Sabi Health Post" },
  { id: "ai5", staffId: "s2", date: day(2), clockIn: "22:03", clockOut: "06:11", source: "Kiosk", breakMins: 30, flags: ["Overnight"], location: "Sabi Health Post" },
  { id: "ai6", staffId: "s3", date: day(2), clockIn: "08:05", clockOut: "16:00", source: "Kiosk", breakMins: 30, flags: [], location: "Sabi Health Post" },
];

export const periods: TimesheetPeriod[] = [
  { id: "pd1", label: "This week", start: day(3), end: day(-3), locked: false },
  { id: "pd0", label: "Last week", start: day(10), end: day(4), locked: true },
];

export const timesheets: Timesheet[] = [
  {
    id: "ts1", staffId: "s2", periodId: "pd1", status: "Submitted", captureMode: "Attendance",
    submittedAt: iso(0),
    lines: [
      { id: "tl1", date: day(1), source: "Attendance", expectedHours: 7.5, workedHours: 7.6, breakHours: 0.58, overtimeHours: 0, container: "Maternity Programme", task: "Ward cover" },
      { id: "tl2", date: day(2), source: "Attendance", expectedHours: 7.5, workedHours: 7.6, breakHours: 0.5, overtimeHours: 0.1, container: "Maternity Programme", task: "Night ward cover", note: "Cross-midnight shift" },
    ],
  },
  {
    id: "ts2", staffId: "s3", periodId: "pd1", status: "Open", captureMode: "Attendance",
    lines: [
      { id: "tl3", date: day(1), source: "Attendance", expectedHours: 7.5, workedHours: 7.2, breakHours: 0.5, overtimeHours: 0, container: "Maternity Programme", task: "Ward cover", note: "22 min late — within grace? no" },
      { id: "tl4", date: day(2), source: "Attendance", expectedHours: 7.5, workedHours: 7.4, breakHours: 0.5, overtimeHours: 0 },
    ],
  },
  {
    id: "ts3", staffId: "s4", periodId: "pd1", status: "Open", captureMode: "Manual",
    lines: [
      { id: "tl5", date: day(1), source: "Manual", expectedHours: 7.5, workedHours: 7.5, breakHours: 0.5, overtimeHours: 0, container: "Records & Reporting", task: "NHMIS monthly return" },
    ],
  },
  {
    id: "ts4", staffId: "s8", periodId: "pd0", status: "Locked", captureMode: "Attendance",
    approvedAt: iso(4), approver: "Dr. Adaeze Okonjo",
    lines: [
      { id: "tl6", date: day(9), source: "Attendance", expectedHours: 7.5, workedHours: 9.2, breakHours: 0.75, overtimeHours: 1.7, container: "Front Office", task: "Registration desk" },
      { id: "tl7", date: day(8), source: "Attendance", expectedHours: 7.5, workedHours: 7.5, breakHours: 0.5, overtimeHours: 0 },
    ],
  },
];

export const policies: TimePolicy[] = [
  {
    id: "po1", scope: "Tenant default", effectiveFrom: day(200),
    periodType: "Weekly", captureDefault: "Hybrid", incrementMins: 15, rounding: "Nearest 15",
    submissionDeadlineDays: 2, approvalDeadlineDays: 3, lateGraceMins: 10, earlyLeaveGraceMins: 10,
    absenceThresholdMins: 240, maxDailyHours: 14, allowEditDerived: true, overtimeEnabled: true, status: "Current",
  },
  {
    id: "po2", scope: "Department: Nursing", effectiveFrom: day(120),
    periodType: "Weekly", captureDefault: "Attendance", incrementMins: 5, rounding: "Nearest 5",
    submissionDeadlineDays: 1, approvalDeadlineDays: 2, lateGraceMins: 5, earlyLeaveGraceMins: 5,
    absenceThresholdMins: 180, maxDailyHours: 16, allowEditDerived: false, overtimeEnabled: true, status: "Current",
  },
];

export const enrolments: Enrolment[] = [
  { id: "en1", selector: "Department: Nursing", captureMode: "Attendance", effectiveFrom: day(120), count: 4, resolvedPolicy: "Department: Nursing" },
  { id: "en2", selector: "Department: Records", captureMode: "Manual", effectiveFrom: day(120), count: 2, resolvedPolicy: "Tenant default" },
  { id: "en3", selector: "Employee: Dr. Adaeze Okonjo", captureMode: "Hybrid", effectiveFrom: day(90), count: 1, resolvedPolicy: "Employee override" },
];

export const containers: WorkContainer[] = [
  { id: "wc1", label: "Programme", name: "Maternity Programme", code: "MAT", owner: "Nurse Grace Nwangbo", status: "Active" },
  { id: "wc2", label: "Programme", name: "EPI / Immunization Campaign", code: "EPI", owner: "Mary Williams", status: "Active" },
  { id: "wc3", label: "Workstream", name: "Records & Reporting", code: "M&E", owner: "Folashade Adeniyi", status: "Active" },
  { id: "wc4", label: "Workstream", name: "Front Office", code: "FO", owner: "Stella Okon", status: "Active" },
];

export const tasks: WorkTask[] = [
  { id: "wt1", containerId: "wc1", name: "Ward cover roster", assignedTo: "Nursing team", status: "In progress", estimateHours: 40, loggedHours: 22 },
  { id: "wt2", containerId: "wc1", name: "Night ward cover", parentId: "wt1", assignedTo: "Wadam Moses", status: "In progress", estimateHours: 20, loggedHours: 15 },
  { id: "wt3", containerId: "wc2", name: "Outreach immunization day", assignedTo: "Abisola Adedokun", status: "Done", estimateHours: 8, loggedHours: 9 },
  { id: "wt4", containerId: "wc3", name: "NHMIS monthly return", assignedTo: "Folashade Adeniyi", status: "In progress", estimateHours: 12, loggedHours: 7 },
  { id: "wt5", containerId: "wc4", name: "Registration desk", assignedTo: "Stella Okon", status: "In progress", estimateHours: 37.5, loggedHours: 31 },
];

export const holidays: Holiday[] = [
  { id: "h1", name: "Independence Day", date: `${new Date().getFullYear()}-10-01`, scope: "Organisation", scopeValue: "All facilities", paid: true, workRequiresApproval: true },
  { id: "h2", name: "Eid al-Maulud", date: `${new Date().getFullYear()}-09-15`, scope: "Organisation", scopeValue: "All facilities", paid: true, workRequiresApproval: true },
  { id: "h3", name: "Workers' Day", date: `${new Date().getFullYear()}-05-01`, scope: "Organisation", scopeValue: "All facilities", paid: true, workRequiresApproval: true },
  { id: "h4", name: "Lagos State Founders' Day", date: `${new Date().getFullYear()}-05-27`, scope: "Location", scopeValue: "Lagos", paid: true, workRequiresApproval: false },
];

export const leaveRequests: LeaveRequest[] = [
  { id: "lv1", staffId: "s3", type: "Annual", from: day(-2), to: day(-9), days: 6, status: "Approved", paid: true, note: "Family visit" },
  { id: "lv2", staffId: "s7", type: "Sick", from: day(4), to: day(3), days: 2, status: "Approved", paid: true, note: "Malaria — RDT positive" },
  { id: "lv3", staffId: "s4", type: "Study", from: day(-20), to: day(-25), days: 5, status: "Pending", paid: false, note: "CHO refresher" },
];

export const holidayWork: HolidayWorkRequest[] = [
  { id: "hw1", staffId: "s2", holidayId: "h2", reason: "Maternity ward on-call — no alternative cover", status: "Approved", hours: 7.5 },
];

export const activities: WorkActivity[] = [
  { id: "wa1", taskId: "wt1", staff: "Grace Nwangbo", date: day(1), hours: 7.5, note: "Day ward cover, 3 admissions" },
  { id: "wa2", taskId: "wt2", staff: "Wadam Moses", date: day(2), hours: 7.6, note: "Night ward cover, 1 delivery" },
  { id: "wa3", taskId: "wt4", staff: "Folashade Adeniyi", date: day(1), hours: 3.5, note: "OPD + EPI tallies reconciled" },
  { id: "wa4", taskId: "wt5", staff: "Stella Okon", date: day(1), hours: 7.5, note: "42 registrations, 3 card reprints" },
];

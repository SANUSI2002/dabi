import { create } from "zustand";
import * as wf from "@/data/workforce";
import type {
  TimeBlock, WeeklySchedule, ScheduleAssignment, AttendanceInterval,
  Timesheet, TimesheetPeriod, TimePolicy, Enrolment,
  WorkContainer, WorkTask, WorkActivity, TimesheetStatus,
} from "@/data/workforce";

const rid = () => Math.random().toString(36).slice(2, 9);

type WorkforceState = {
  timeBlocks: TimeBlock[];
  schedules: WeeklySchedule[];
  assignments: ScheduleAssignment[];
  attendance: AttendanceInterval[];
  periods: TimesheetPeriod[];
  timesheets: Timesheet[];
  policies: TimePolicy[];
  enrolments: Enrolment[];
  containers: WorkContainer[];
  tasks: WorkTask[];
  activities: WorkActivity[];

  addTimeBlock: (b: Omit<TimeBlock, "id" | "active">) => void;
  addSchedule: (s: Omit<WeeklySchedule, "id" | "status">) => void;
  assignSchedule: (a: Omit<ScheduleAssignment, "id">) => void;

  clockIn: (staffId: string) => void;
  clockOut: (id: string) => void;
  correctInterval: (id: string, patch: Partial<AttendanceInterval>) => void;

  setTimesheetStatus: (id: string, status: TimesheetStatus, approver?: string) => void;
  addManualLine: (timesheetId: string, line: Omit<Timesheet["lines"][number], "id">) => void;

  logActivity: (a: Omit<WorkActivity, "id">) => void;
  addTask: (t: Omit<WorkTask, "id" | "loggedHours">) => void;
};

const hhmm = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const useWorkforce = create<WorkforceState>((set) => ({
  timeBlocks: wf.timeBlocks,
  schedules: wf.schedules,
  assignments: wf.assignments,
  attendance: wf.attendanceIntervals,
  periods: wf.periods,
  timesheets: wf.timesheets,
  policies: wf.policies,
  enrolments: wf.enrolments,
  containers: wf.containers,
  tasks: wf.tasks,
  activities: wf.activities,

  addTimeBlock: (b) => set((s) => ({ timeBlocks: [{ ...b, id: rid(), active: true }, ...s.timeBlocks] })),
  addSchedule: (sc) => set((s) => ({ schedules: [{ ...sc, id: rid(), status: "Draft" }, ...s.schedules] })),
  assignSchedule: (a) => set((s) => ({ assignments: [{ ...a, id: rid() }, ...s.assignments] })),

  clockIn: (staffId) =>
    set((s) => ({
      attendance: [
        {
          id: rid(), staffId, date: new Date().toISOString().slice(0, 10),
          clockIn: hhmm(), source: "Web", breakMins: 0, flags: [], location: "Sabi Health Post",
        },
        ...s.attendance,
      ],
    })),

  clockOut: (id) =>
    set((s) => ({
      attendance: s.attendance.map((a) =>
        a.id === id
          ? { ...a, clockOut: hhmm(), flags: a.flags.filter((f) => f !== "Missing checkout") }
          : a,
      ),
    })),

  correctInterval: (id, patch) =>
    set((s) => ({
      attendance: s.attendance.map((a) => (a.id === id ? { ...a, ...patch, flags: [...new Set([...a.flags, "Corrected"])] } : a)),
    })),

  setTimesheetStatus: (id, status, approver) =>
    set((s) => ({
      timesheets: s.timesheets.map((t) =>
        t.id === id
          ? {
              ...t,
              status,
              submittedAt: status === "Submitted" ? new Date().toISOString() : t.submittedAt,
              approvedAt: status === "Approved" || status === "Locked" ? new Date().toISOString() : t.approvedAt,
              approver: approver ?? t.approver,
            }
          : t,
      ),
    })),

  addManualLine: (timesheetId, line) =>
    set((s) => ({
      timesheets: s.timesheets.map((t) =>
        t.id === timesheetId ? { ...t, lines: [...t.lines, { ...line, id: rid() }] } : t,
      ),
    })),

  logActivity: (a) =>
    set((s) => ({
      activities: [{ ...a, id: rid() }, ...s.activities],
      tasks: s.tasks.map((t) => (t.id === a.taskId ? { ...t, loggedHours: t.loggedHours + a.hours } : t)),
    })),

  addTask: (t) => set((s) => ({ tasks: [{ ...t, id: rid(), loggedHours: 0 }, ...s.tasks] })),
}));

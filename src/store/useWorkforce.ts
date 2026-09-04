import { create } from "zustand";
import * as wf from "@/data/workforce";
import { audit } from "@/store/useAudit";
import { useHr } from "@/store/useHr";
import type {
  TimeBlock, WeeklySchedule, ScheduleAssignment, AttendanceInterval,
  Timesheet, TimesheetPeriod, TimePolicy, Enrolment,
  WorkContainer, WorkTask, WorkActivity, TimesheetStatus,
  Holiday, LeaveRequest, HolidayWorkRequest,
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
  holidays: Holiday[];
  leave: LeaveRequest[];
  holidayWork: HolidayWorkRequest[];

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
  addHoliday: (h: Omit<Holiday, "id">) => void;
  requestLeave: (l: Omit<LeaveRequest, "id" | "status">) => void;
  setLeaveStatus: (id: string, status: LeaveRequest["status"]) => void;
  setHolidayWorkStatus: (id: string, status: HolidayWorkRequest["status"]) => void;
};

const hhmm = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const who = (id: string) => useHr.getState().byId(id)?.name ?? id;

export const useWorkforce = create<WorkforceState>((set, get) => ({
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
  holidays: wf.holidays,
  leave: wf.leaveRequests,
  holidayWork: wf.holidayWork,

  addTimeBlock: (b) => {
    audit("created time block", `workforce/schedule/${b.code}`);
    set((s) => ({ timeBlocks: [{ ...b, id: rid(), active: true }, ...s.timeBlocks] }));
  },
  addSchedule: (sc) => {
    audit("created schedule", `workforce/schedule/${sc.name}`);
    set((s) => ({ schedules: [{ ...sc, id: rid(), status: "Draft" }, ...s.schedules] }));
  },
  assignSchedule: (a) => {
    audit("assigned schedule", `workforce/assignment/${who(a.staffId)}`);
    set((s) => ({ assignments: [{ ...a, id: rid() }, ...s.assignments] }));
  },

  clockIn: (staffId) => {
    audit("clocked in", `workforce/attendance/${who(staffId)}`);
    set((s) => ({
      attendance: [
        {
          id: rid(), staffId, date: new Date().toISOString().slice(0, 10),
          clockIn: hhmm(), source: "Web", breakMins: 0, flags: [], location: "Sabi Health Post",
        },
        ...s.attendance,
      ],
    }));
  },

  clockOut: (id) => {
    const a = get().attendance.find((x) => x.id === id);
    audit("clocked out", `workforce/attendance/${a ? who(a.staffId) : id}`);
    set((s) => ({
      attendance: s.attendance.map((x) =>
        x.id === id
          ? { ...x, clockOut: hhmm(), flags: x.flags.filter((f) => f !== "Missing checkout") }
          : x,
      ),
    }));
  },

  correctInterval: (id, patch) => {
    audit("corrected attendance", `workforce/attendance/${id}`);
    set((s) => ({
      attendance: s.attendance.map((a) => (a.id === id ? { ...a, ...patch, flags: [...new Set([...a.flags, "Corrected"])] } : a)),
    }));
  },

  setTimesheetStatus: (id, status, approver) => {
    const t = get().timesheets.find((x) => x.id === id);
    audit(`timesheet ${status.toLowerCase()}`, `workforce/timesheet/${t ? who(t.staffId) : id}`, approver ? { user: approver } : undefined);
    set((s) => ({
      timesheets: s.timesheets.map((x) =>
        x.id === id
          ? {
              ...x,
              status,
              submittedAt: status === "Submitted" ? new Date().toISOString() : x.submittedAt,
              approvedAt: status === "Approved" || status === "Locked" ? new Date().toISOString() : x.approvedAt,
              approver: approver ?? x.approver,
            }
          : x,
      ),
    }));
  },

  addManualLine: (timesheetId, line) =>
    set((s) => ({
      timesheets: s.timesheets.map((t) =>
        t.id === timesheetId ? { ...t, lines: [...t.lines, { ...line, id: rid() }] } : t,
      ),
    })),

  logActivity: (a) => {
    audit("logged activity", `workforce/task/${a.taskId}`);
    set((s) => ({
      activities: [{ ...a, id: rid() }, ...s.activities],
      tasks: s.tasks.map((t) => (t.id === a.taskId ? { ...t, loggedHours: t.loggedHours + a.hours } : t)),
    }));
  },

  addTask: (t) => set((s) => ({ tasks: [{ ...t, id: rid(), loggedHours: 0 }, ...s.tasks] })),

  addHoliday: (h) => {
    audit("added holiday", `workforce/holiday/${h.name}`);
    set((s) => ({ holidays: [{ ...h, id: rid() }, ...s.holidays] }));
  },
  requestLeave: (l) => {
    audit("requested leave", `workforce/leave/${who(l.staffId)}`);
    set((s) => ({ leave: [{ ...l, id: rid(), status: "Pending" }, ...s.leave] }));
  },
  setLeaveStatus: (id, status) => {
    const l = get().leave.find((x) => x.id === id);
    audit(`leave ${status.toLowerCase()}`, `workforce/leave/${l ? who(l.staffId) : id}`);
    set((s) => ({ leave: s.leave.map((x) => (x.id === id ? { ...x, status } : x)) }));
  },
  setHolidayWorkStatus: (id, status) => {
    audit(`holiday-work ${status.toLowerCase()}`, `workforce/holiday-work/${id}`);
    set((s) => ({ holidayWork: s.holidayWork.map((x) => (x.id === id ? { ...x, status } : x)) }));
  },
}));

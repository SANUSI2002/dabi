import { create } from "zustand";
import * as wf from "@/data/workforce";
import { audit } from "@/store/useAudit";
import { useHr } from "@/store/useHr";
import type {
  TimeBlock, WeeklySchedule, ScheduleAssignment, AttendanceInterval,
  Timesheet, TimesheetPeriod, TimePolicy, Enrolment,
  WorkContainer, WorkTask, WorkActivity, TimesheetStatus,
  Holiday, LeaveRequest, HolidayWorkRequest, WorkLocation,
  BreakRule, ModuleCapability, ModuleCapabilityKey, AttendanceRule,
  OvertimeRequest, ExceptionResolution,
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
  breakRules: BreakRule[];
  capabilities: ModuleCapability[];
  attendanceRules: AttendanceRule[];
  containers: WorkContainer[];
  tasks: WorkTask[];
  activities: WorkActivity[];
  holidays: Holiday[];
  leave: LeaveRequest[];
  holidayWork: HolidayWorkRequest[];
  overtime: OvertimeRequest[];

  addTimeBlock: (b: Omit<TimeBlock, "id" | "active">) => void;
  addSchedule: (s: Omit<WeeklySchedule, "id" | "status">) => void;
  assignSchedule: (a: Omit<ScheduleAssignment, "id">) => void;
  addPolicy: (p: Omit<TimePolicy, "id" | "status">) => void;
  toggleCapability: (key: ModuleCapabilityKey) => void;

  clockIn: (staffId: string, opts?: { workLocation?: WorkLocation; location?: string }) => void;
  clockOut: (id: string) => void;
  startBreak: (id: string) => void;
  endBreak: (id: string) => void;
  correctInterval: (id: string, patch: Partial<AttendanceInterval>) => void;
  resolveException: (id: string, action: ExceptionResolution["action"], note: string, actor: string) => void;

  requestOvertime: (r: Omit<OvertimeRequest, "id" | "status" | "requestedAt">) => void;
  setOvertimeStatus: (id: string, status: "Approved" | "Rejected", actor: string, note?: string) => void;

  setTimesheetStatus: (id: string, status: TimesheetStatus, actor?: string, note?: string) => void;
  recallTimesheet: (id: string, actor?: string) => void;
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
  breakRules: wf.breakRules,
  capabilities: wf.moduleCapabilities,
  attendanceRules: wf.attendanceRules,
  containers: wf.containers,
  tasks: wf.tasks,
  activities: wf.activities,
  holidays: wf.holidays,
  leave: wf.leaveRequests,
  holidayWork: wf.holidayWork,
  overtime: wf.overtimeRequests,

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
  addPolicy: (p) => {
    audit("created policy version", `workforce/policy/${p.scope}`);
    set((s) => ({ policies: [{ ...p, id: rid(), status: "Future" }, ...s.policies] }));
  },
  toggleCapability: (key) => {
    const cap = get().capabilities.find((c) => c.key === key);
    audit(cap?.enabled ? "suspended capability" : "enabled capability", `workforce/capability/${key}`);
    set((s) => ({
      capabilities: s.capabilities.map((c) => (c.key === key ? { ...c, enabled: !c.enabled } : c)),
    }));
  },

  clockIn: (staffId, opts) => {
    audit("clocked in", `workforce/attendance/${who(staffId)}`);
    set((s) => ({
      attendance: [
        {
          id: rid(), staffId, date: new Date().toISOString().slice(0, 10),
          clockIn: hhmm(), source: "Web", breakMins: 0, flags: [],
          location: opts?.location ?? "Sabi Health Post",
          workLocation: opts?.workLocation ?? "WFO",
          consentAt: new Date().toISOString(),
        },
        ...s.attendance,
      ],
    }));
  },

  clockOut: (id) => {
    const a = get().attendance.find((x) => x.id === id);
    audit("clocked out", `workforce/attendance/${a ? who(a.staffId) : id}`);
    set((s) => ({
      attendance: s.attendance.map((x) => {
        if (x.id !== id) return x;
        // close any open break into the total
        const extra = x.onBreakSince
          ? Math.max(0, Math.round((Date.now() - +new Date(x.onBreakSince)) / 60000))
          : 0;
        return {
          ...x,
          clockOut: hhmm(),
          breakMins: x.breakMins + extra,
          onBreakSince: undefined,
          flags: x.flags.filter((f) => f !== "Missing checkout" && f !== "On break"),
        };
      }),
    }));
  },

  startBreak: (id) => {
    const a = get().attendance.find((x) => x.id === id);
    if (!a || a.clockOut || a.onBreakSince) return;
    audit("started break", `workforce/attendance/${who(a.staffId)}`);
    set((s) => ({
      attendance: s.attendance.map((x) =>
        x.id === id
          ? { ...x, onBreakSince: new Date().toISOString(), flags: [...new Set([...x.flags, "On break"])] }
          : x,
      ),
    }));
  },

  endBreak: (id) => {
    const a = get().attendance.find((x) => x.id === id);
    if (!a || !a.onBreakSince) return;
    const mins = Math.max(1, Math.round((Date.now() - +new Date(a.onBreakSince)) / 60000));
    audit("ended break", `workforce/attendance/${who(a.staffId)}`);
    set((s) => ({
      attendance: s.attendance.map((x) =>
        x.id === id
          ? { ...x, breakMins: x.breakMins + mins, onBreakSince: undefined, flags: x.flags.filter((f) => f !== "On break") }
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

  resolveException: (id, action, note, actor) => {
    const a = get().attendance.find((x) => x.id === id);
    if (!a) return;
    audit(`exception ${action.toLowerCase()}`, `workforce/attendance/${who(a.staffId)}`, { user: actor });
    set((s) => ({
      attendance: s.attendance.map((x) =>
        x.id === id
          ? {
              ...x,
              exceptionResolution: { action, by: actor, at: new Date().toISOString(), note: note || undefined },
              flags: [...new Set([...x.flags, "Reviewed"])],
            }
          : x,
      ),
    }));
  },

  requestOvertime: (r) => {
    audit("requested overtime", `workforce/overtime/${who(r.staffId)}`);
    set((s) => ({
      overtime: [{ ...r, id: rid(), status: "Pending", requestedAt: new Date().toISOString() }, ...s.overtime],
    }));
  },

  setOvertimeStatus: (id, status, actor, note) => {
    const r = get().overtime.find((x) => x.id === id);
    if (!r) return;
    audit(`overtime ${status.toLowerCase()}`, `workforce/overtime/${who(r.staffId)}`, { user: actor });
    const now = new Date().toISOString();
    set((s) => ({
      overtime: s.overtime.map((x) =>
        x.id === id ? { ...x, status, decidedBy: actor, decidedAt: now, decisionNote: note } : x,
      ),
    }));
    // approved overtime flows onto the employee's open/returned timesheet
    if (status === "Approved") {
      const dateKey = r.date.slice(0, 10);
      set((s) => ({
        timesheets: s.timesheets.map((t) => {
          if (t.staffId !== r.staffId || !["Open", "Returned"].includes(t.status)) return t;
          const line = t.lines.find((l) => l.date.slice(0, 10) === dateKey);
          if (line) {
            return {
              ...t,
              lines: t.lines.map((l) =>
                l.id === line.id ? { ...l, overtimeHours: +(l.overtimeHours + r.hours).toFixed(2) } : l,
              ),
            };
          }
          return {
            ...t,
            lines: [
              ...t.lines,
              {
                id: rid(), date: r.date, source: "Manual" as const,
                expectedHours: 0, workedHours: r.hours, breakHours: 0, overtimeHours: r.hours,
                note: `Approved overtime — ${r.reason}`,
              },
            ],
          };
        }),
      }));
    }
  },

  setTimesheetStatus: (id, status, actor, note) => {
    const t = get().timesheets.find((x) => x.id === id);
    const by = actor ?? (t ? who(t.staffId) : "System");
    audit(`timesheet ${status.toLowerCase()}`, `workforce/timesheet/${t ? who(t.staffId) : id}`, actor ? { user: actor } : undefined);
    const now = new Date().toISOString();
    set((s) => ({
      timesheets: s.timesheets.map((x) => {
        if (x.id !== id) return x;
        // submitting from Open / Returned freezes a new version
        const version = status === "Submitted" ? x.version + 1 : x.version;
        return {
          ...x,
          status,
          version,
          history: [...x.history, { version, status, at: now, by, note }],
          submittedAt: status === "Submitted" ? now : x.submittedAt,
          approvedAt: status === "Approved" || status === "Locked" ? now : x.approvedAt,
          approver: status === "Approved" || status === "Locked" ? by : x.approver,
          returnNote: status === "Returned" ? note : status === "Submitted" ? undefined : x.returnNote,
        };
      }),
    }));
  },

  recallTimesheet: (id, actor) => {
    const t = get().timesheets.find((x) => x.id === id);
    if (!t || t.status !== "Submitted") return;
    const by = actor ?? who(t.staffId);
    audit("timesheet recalled", `workforce/timesheet/${who(t.staffId)}`);
    const now = new Date().toISOString();
    set((s) => ({
      timesheets: s.timesheets.map((x) =>
        x.id === id
          ? { ...x, status: "Open", history: [...x.history, { version: x.version, status: "Open", at: now, by, note: "Recalled by employee" }] }
          : x,
      ),
    }));
  },

  addManualLine: (timesheetId, line) => {
    audit("added timesheet line", `workforce/timesheet/${timesheetId}`);
    set((s) => ({
      timesheets: s.timesheets.map((t) =>
        t.id === timesheetId ? { ...t, lines: [...t.lines, { ...line, id: rid() }] } : t,
      ),
    }));
  },

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

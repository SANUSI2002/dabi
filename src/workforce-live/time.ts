import { create } from "zustand";
import { useWorkforce } from "@/store/useWorkforce";
import { useHr } from "@/store/useHr";
import { workforceRequest } from "@/emr-live/client";
import type { AttendanceInterval, Timesheet, TimesheetPeriod, TimePolicy, WeeklySchedule } from "@/data/workforce";
import { adoptLiveIdentity, clean, isoDay, liveChange, uuid } from "./sync";
import { useOrg } from "@/store/useOrg";

// Time & attendance, leave and work in live mode (GET /time): fills useWorkforce from the Workforce API
// (scoped by the server to what the signed-in person may see) and makes its actions write to it.
// `useLiveTimeMeta` carries who the signed-in person is here, for the screens' scope (wfScope).

type Versioned = { version?: number; rowVersion?: number };
type ApiTime = {
  selfEmployeeId: string | null; reportIds: string[]; seesEveryone: boolean; currentPeriodId: string; timeZone: string; onLeaveToday: string[];
  timeBlocks: ReturnType<typeof useWorkforce.getState>["timeBlocks"]; schedules: (WeeklySchedule & Versioned)[]; assignments: ReturnType<typeof useWorkforce.getState>["assignments"];
  attendance: (AttendanceInterval & Versioned & { clockInAt: string; clockOutAt: string | null })[]; periods: (TimesheetPeriod & Versioned)[];
  timesheets: (Timesheet & Versioned)[]; policies: TimePolicy[];
  settings: { capabilities: ReturnType<typeof useWorkforce.getState>["capabilities"]; breakRules: ReturnType<typeof useWorkforce.getState>["breakRules"]; attendanceRules: ReturnType<typeof useWorkforce.getState>["attendanceRules"]; enrolments: ReturnType<typeof useWorkforce.getState>["enrolments"]; version: number };
  holidays: ReturnType<typeof useWorkforce.getState>["holidays"]; leave: ReturnType<typeof useWorkforce.getState>["leave"]; holidayWork: ReturnType<typeof useWorkforce.getState>["holidayWork"];
  overtime: ReturnType<typeof useWorkforce.getState>["overtime"]; amendments: ReturnType<typeof useWorkforce.getState>["amendments"];
  containers: ReturnType<typeof useWorkforce.getState>["containers"]; tasks: ReturnType<typeof useWorkforce.getState>["tasks"]; activities: ReturnType<typeof useWorkforce.getState>["activities"];
};

export const useLiveTimeMeta = create<{ loaded: boolean; selfEmployeeId: string | null; reportIds: string[]; seesEveryone: boolean; currentPeriodId: string; settingsVersion: number }>(() => ({
  loaded: false, selfEmployeeId: null, reportIds: [], seesEveryone: false, currentPeriodId: "", settingsVersion: 1,
}));

const noNull = <T extends object>(row: T) => Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null)) as T;

export async function loadTime() {
  const { data } = await workforceRequest<{ data: ApiTime }>("/time");
  useLiveTimeMeta.setState({ loaded: true, selfEmployeeId: data.selfEmployeeId, reportIds: data.reportIds, seesEveryone: data.seesEveryone, currentPeriodId: data.currentPeriodId, settingsVersion: data.settings.version });
  adoptLiveIdentity(data.selfEmployeeId, data.reportIds);
  useWorkforce.setState({
    timeBlocks: data.timeBlocks, schedules: data.schedules, assignments: data.assignments, attendance: data.attendance.map((a) => noNull(a)), periods: data.periods.map((p) => noNull(p)),
    timesheets: data.timesheets.map((t) => noNull(t)), policies: data.policies, capabilities: data.settings.capabilities, breakRules: data.settings.breakRules,
    attendanceRules: data.settings.attendanceRules, enrolments: data.settings.enrolments, holidays: data.holidays, leave: data.leave.map((l) => noNull(l)),
    holidayWork: data.holidayWork, overtime: data.overtime.map((o) => noNull(o)), amendments: data.amendments.map((a) => noNull(a)), containers: data.containers,
    tasks: data.tasks, activities: data.activities,
  });
}

/** Colleagues' names and roles for people without HR access (rosters, schedules, approvals). */
export async function loadDirectory() {
  const { data } = await workforceRequest<{ data: {
    employees: { id: string; name: string; role: string; cadre: string; status: string; hireDate: string }[];
    departments?: { id: string; name: string; code: string; status: string; hodEmployeeId: string | null; deputyHodEmployeeId: string | null }[];
    jobPositions?: { id: string; name: string; departmentId: string }[];
  } }>("/people/directory");
  // Department names and heads (for vacancy requests and rosters) — no people records beyond names.
  useOrg.setState({
    departments: (data.departments ?? []).map((d) => ({ id: d.id, name: d.name, code: d.code, companyIds: [], status: d.status as "Active", hodId: d.hodEmployeeId ?? undefined, deputyHodId: d.deputyHodEmployeeId ?? undefined, staffIds: [], createdAt: "" })),
    jobPositions: data.jobPositions ?? [],
  });
  useHr.setState({ staff: data.employees.map((e) => ({ id: e.id, name: e.name, role: e.role, cadre: e.cadre, hireDate: e.hireDate, status: e.status === "ACTIVE" ? "Active" : "Inactive", username: e.name.toLowerCase().replace(/[^a-z ]/g, "").trim().split(/\s+/).slice(-2).join(".") })) });
}

const reload = () => loadTime();
const post = (path: string, body: unknown, version?: number) => workforceRequest(path, { method: "POST", body, ...(version !== undefined ? { version } : {}) });
const versionIn = <T extends { id: string } & Versioned>(list: T[], id: string, key: "version" | "rowVersion" = "version") => {
  const found = list.find((x) => x.id === id);
  if (!found) throw new Error("This record is no longer in the list; refresh and try again.");
  return (found[key] ?? 1) as number;
};
const wf = () => useWorkforce.getState() as unknown as { attendance: (AttendanceInterval & Versioned)[]; timesheets: (Timesheet & Versioned)[]; periods: (TimesheetPeriod & Versioned)[]; schedules: (WeeklySchedule & Versioned)[] } & Record<string, ({ id: string } & Versioned)[]>;
/** A screen's HH:mm on the interval's day, as an instant (the browser's time zone is the hospital's). */
const instant = (day: string, hhmm?: string) => (hhmm ? new Date(`${day}T${hhmm}:00`).toISOString() : undefined);

export function goLiveTime() {
  useWorkforce.setState({
    addTimeBlock: (b) => { void liveChange(() => post("/time/blocks", { name: b.name, code: b.code, start: b.start, end: b.end, overnight: b.overnight, paidHours: b.paidHours, breakMins: b.breakMins, lateGraceMins: b.lateGraceMins, classification: b.classification, colour: b.colour }), reload); },
    addSchedule: (s) => {
      void liveChange(() => post("/time/schedules", clean({ id: uuid(), name: s.name, description: s.description, startDate: isoDay(s.startDate), endDate: isoDay(s.endDate), days: s.days, rotation: s.rotation, rotationAnchor: isoDay(s.rotationAnchor), holidayRule: s.holidayRule, expectedCycleHours: s.expectedCycleHours })), reload);
    },
    assignSchedule: (a) => { void liveChange(() => post("/time/assignments", clean({ staffId: a.staffId, scheduleId: a.scheduleId, effectiveFrom: isoDay(a.effectiveFrom), effectiveTo: isoDay(a.effectiveTo), captureMode: a.captureMode })), reload); },
    addPolicy: (p) => { void liveChange(() => post("/time/policies", clean({ ...p, effectiveFrom: isoDay(p.effectiveFrom), effectiveTo: isoDay(p.effectiveTo) })), reload); },
    toggleCapability: (key) => {
      void liveChange(async () => {
        const capabilities = useWorkforce.getState().capabilities.map((c) => (c.key === key ? { ...c, enabled: !c.enabled } : c));
        await workforceRequest("/time/settings", { method: "PUT", version: useLiveTimeMeta.getState().settingsVersion, body: { capabilities } });
      }, reload, () => useWorkforce.setState((s) => ({ capabilities: s.capabilities.map((c) => (c.key === key ? { ...c, enabled: !c.enabled } : c)) })));
    },

    clockIn: (staffId, opts) => {
      const self = useLiveTimeMeta.getState().selfEmployeeId;
      void liveChange(() => post("/time/attendance/clock-in", clean({ employeeId: staffId === self ? undefined : staffId, workLocation: opts?.workLocation, location: opts?.location, consent: true })), reload);
    },
    clockOut: (id) => { void liveChange(() => post(`/time/attendance/${id}/clock-out`, {}), reload); },
    startBreak: (id) => { void liveChange(() => post(`/time/attendance/${id}/break-start`, {}), reload); },
    endBreak: (id) => { void liveChange(() => post(`/time/attendance/${id}/break-end`, {}), reload); },
    correctInterval: (id, patch) => {
      void liveChange(async () => {
        const interval = wf().attendance.find((a) => a.id === id);
        if (!interval) throw new Error("This attendance is no longer in the list; refresh and try again.");
        await post(`/time/attendance/${id}/correct`, clean({ clockInAt: instant(interval.date, patch.clockIn), clockOutAt: instant(interval.date, patch.clockOut), breakMins: patch.breakMins }), interval.version ?? 1);
      }, reload);
    },
    resolveException: (id, action, note) => { void liveChange(() => post(`/time/attendance/${id}/resolve`, clean({ action, note: note || undefined }), versionIn(wf().attendance, id)), reload); },

    requestOvertime: (r) => { void liveChange(() => post("/time/overtime", clean({ employeeId: r.staffId, date: isoDay(r.date), hours: r.hours, reason: r.reason })), reload); },
    setOvertimeStatus: (id, status, _actor, note) => { void liveChange(() => post(`/time/overtime/${id}/decide`, clean({ status, note: note || undefined }), versionIn(wf().overtime, id)), reload); },

    setTimesheetStatus: (id, status, _actor, note) => {
      void liveChange(async () => {
        const version = versionIn(wf().timesheets, id, "rowVersion");
        if (status === "Submitted") await post(`/time/timesheets/${id}/submit`, {}, version);
        else if (status === "Approved" || status === "Returned" || status === "Rejected") await post(`/time/timesheets/${id}/decide`, clean({ status, note: note || undefined }), version);
        else throw new Error(`A timesheet is moved to ${status} by locking its period or recalling it.`);
      }, reload);
    },
    recallTimesheet: (id) => { void liveChange(() => post(`/time/timesheets/${id}/recall`, {}, versionIn(wf().timesheets, id, "rowVersion")), reload); },
    addManualLine: (timesheetId, line) => {
      void liveChange(() => post(`/time/timesheets/${timesheetId}/lines`, clean({ date: isoDay(line.date), workedHours: line.workedHours, expectedHours: line.expectedHours, breakHours: line.breakHours, overtimeHours: line.overtimeHours, container: line.container, task: line.task, note: line.note })), reload);
    },
    lockPeriod: (periodId) => { void liveChange(() => post(`/time/periods/${periodId}/lock`, {}, versionIn(wf().periods, periodId)), reload); },
    reopenPeriod: (periodId) => { void liveChange(() => post(`/time/periods/${periodId}/reopen`, {}, versionIn(wf().periods, periodId)), reload); },
    requestAmendment: (a) => { void liveChange(() => post("/time/amendments", { timesheetId: a.timesheetId, reason: a.reason, change: a.change }), reload); },
    decideAmendment: (id, status, _actor, note) => { void liveChange(() => post(`/time/amendments/${id}/decide`, clean({ status, note: note || undefined }), versionIn(wf().amendments, id)), reload); },

    logActivity: (a) => { void liveChange(() => post("/time/work/activities", clean({ taskId: a.taskId, date: isoDay(a.date), hours: a.hours, note: a.note, staff: a.staff })), reload); },
    addTask: (t) => { void liveChange(() => post("/time/work/tasks", clean({ containerId: t.containerId, name: t.name, parentId: t.parentId, assignedTo: t.assignedTo, estimateHours: t.estimateHours })), reload); },
    addHoliday: (h) => { void liveChange(() => post("/time/holidays", { name: h.name, date: isoDay(h.date), scope: h.scope, scopeValue: h.scopeValue, paid: h.paid, workRequiresApproval: h.workRequiresApproval }), reload); },
    requestLeave: (l) => { void liveChange(() => post("/time/leave", clean({ employeeId: l.staffId, type: l.type, from: isoDay(l.from), to: isoDay(l.to), days: l.days || undefined, paid: l.paid, note: l.note })), reload); },
    setLeaveStatus: (id, status) => { void liveChange(() => post(`/time/leave/${id}/decide`, { status }, versionIn(wf().leave, id)), reload); },
    setHolidayWorkStatus: (id, status) => { void liveChange(() => post(`/time/holiday-work/${id}/decide`, { status }, versionIn(wf().holidayWork, id)), reload); },
  });
}

/** Adds a work item (programme, initiative…) — the demo seeds these; a live organization creates its own. */
export function addWorkContainer(c: { label: string; name: string; code: string; owner: string }) {
  return liveChange(() => post("/time/work/containers", c), reload);
}

export function clearTime() {
  useLiveTimeMeta.setState({ loaded: false, selfEmployeeId: null, reportIds: [], seesEveryone: false });
  useWorkforce.setState({
    timeBlocks: [], schedules: [], assignments: [], attendance: [], periods: [], timesheets: [], policies: [], enrolments: [], breakRules: [], attendanceRules: [],
    containers: [], tasks: [], activities: [], holidays: [], leave: [], holidayWork: [], overtime: [], amendments: [],
  });
}

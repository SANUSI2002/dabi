import { cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ workforceRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/emr-live/client")>()), workforceRequest: api.workforceRequest }));

import WorkforceDashboard from "@/pages/workforce/WorkforceDashboard";
import Schedules from "@/pages/workforce/Schedules";
import Attendance from "@/pages/workforce/Attendance";
import Timesheets from "@/pages/workforce/Timesheets";
import Approvals from "@/pages/workforce/Approvals";
import HolidayLeave from "@/pages/workforce/HolidayLeave";
import WorkTasks from "@/pages/workforce/WorkTasks";
import WorkforceReports from "@/pages/workforce/WorkforceReports";
import TimePolicy from "@/pages/workforce/TimePolicy";
import Hris from "@/pages/admin/Hris";
import EmployeeDirectory from "@/pages/hr/EmployeeDirectory";
import OrgSetup from "@/pages/hr/OrgSetup";
import OrgChart from "@/pages/hr/OrgChart";
import Departments from "@/pages/hr/Departments";
import WorkflowInbox from "@/pages/platform/WorkflowInbox";
import WorkflowBuilder from "@/pages/platform/WorkflowBuilder";
import { useLiveEmr } from "@/emr-live/session";
import { LiveWorkforceSync } from "./LiveWorkforceSync";
import { useLiveTimeMeta } from "./time";
import { useHr } from "@/store/useHr";

const HQ = "00000000-0000-4000-8000-0000000000a1";
const B = "00000000-0000-4000-8000-0000000000b1";
const time = {
  selfEmployeeId: "e1", reportIds: [], seesEveryone: true, currentPeriodId: "p1", timeZone: "Africa/Lagos", onLeaveToday: [],
  timeBlocks: [{ id: B, name: "Day", code: "D", start: "08:00", end: "16:00", overnight: false, paidHours: 8, breakMins: 30, lateGraceMins: 10, classification: "Working", colour: "#0fc06d", active: true }],
  schedules: [{ id: "s1", name: "Weekdays", startDate: "2026-01-01", days: { Mon: B, Tue: B, Wed: B, Thu: B, Fri: B, Sat: "Off", Sun: "Off" }, holidayRule: "Observe as non-working", expectedCycleHours: 40, status: "Active", version: 1 }],
  assignments: [{ id: "as1", staffId: "e1", scheduleId: "s1", effectiveFrom: "2026-01-01", captureMode: "Attendance" }],
  attendance: [{ id: "a1", staffId: "e1", date: "2026-10-20", clockIn: "08:02", clockOut: "16:05", source: "Web", breakMins: 30, flags: [], workLocation: "WFO", version: 3 }],
  periods: [{ id: "p1", label: "Oct 2026", start: "2026-10-01", end: "2026-10-31", locked: false, version: 1 }],
  timesheets: [{ id: "t1", staffId: "e1", periodId: "p1", status: "Submitted", captureMode: "Attendance", version: 1, rowVersion: 5, submittedAt: "2026-10-20T17:00:00.000Z", lines: [{ id: "l1", date: "2026-10-20", source: "Attendance", expectedHours: 8, workedHours: 7.55, breakHours: 0.5, overtimeHours: 0 }], history: [{ version: 1, status: "Submitted", at: "2026-10-20T17:00:00.000Z", by: "Grace" }] }],
  policies: [{ id: "po", scope: "Organisation default", effectiveFrom: "2026-10-01", periodType: "Monthly", captureDefault: "Attendance", incrementMins: 15, rounding: "None", submissionDeadlineDays: 3, approvalDeadlineDays: 5, lateGraceMins: 10, earlyLeaveGraceMins: 10, absenceThresholdMins: 240, maxDailyHours: 16, allowEditDerived: false, overtimeEnabled: true, status: "Current" }],
  settings: { capabilities: [{ key: "Attendance", enabled: true, note: "" }, { key: "Scheduling", enabled: true, note: "" }, { key: "Timesheets", enabled: true, note: "" }], breakRules: [], attendanceRules: [], enrolments: [], version: 3 },
  holidays: [{ id: "h1", name: "Independence Day", date: "2026-10-01", scope: "Organisation", scopeValue: "All", paid: true, workRequiresApproval: true }],
  leave: [{ id: "lv1", staffId: "e1", type: "Annual Leave", from: "2026-12-21", to: "2026-12-24", days: 4, status: "Pending", paid: true, version: 1 }],
  holidayWork: [], overtime: [], amendments: [], containers: [], tasks: [], activities: [],
};
const people = {
  companies: [{ id: HQ, name: "Sabi Test General Hospital", code: "HQ", isHeadquarters: true, address: "", lga: "", state: "Lagos", country: "Nigeria", version: 1 }],
  departments: [], hodChanges: [], jobPositions: [], jobRoles: [], employeeTypes: [], tags: [],
  employees: [{ id: "e1", userId: "u1", name: "Grace Nwangbo", role: "Nurse", cadre: "", phone: null, email: "grace@hospital.test", hireDate: "2024-03-01", license: null, status: "ACTIVE", companyId: HQ, tagIds: [], version: 1 }],
  documents: [], actionTypes: [], disciplinaryActions: [], notes: [], bonusPoints: [], qualifications: [], policies: [],
};
const workflows = { selfEmployeeId: "e1", canManage: true, connectedTriggers: [], defs: [], instances: [], inbox: [] };
const SCREENS = { WorkforceDashboard, Schedules, Attendance, Timesheets, Approvals, HolidayLeave, WorkTasks, WorkforceReports, TimePolicy, Hris, EmployeeDirectory, OrgSetup, OrgChart, Departments, WorkflowInbox, WorkflowBuilder };

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
  api.workforceRequest.mockReset();
  api.workforceRequest.mockImplementation(async (path: string) => (path === "/time" ? { data: time } : path === "/people" ? { data: people } : path === "/workflows" ? { data: workflows } : { data: {} }));
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u1", name: "HR Officer", email: "hr@hospital.test", role: "HR Officer" },
    access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["HR_OFFICER"], permissions: ["hr.read", "hr.manage", "workforce.self", "workforce.approve", "workforce.manage", "workforce.directory", "workflow.manage"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("every live Workforce and people screen opens", () => {
  for (const [name, Screen] of Object.entries(SCREENS)) {
    it(`${name}: empty, then with the organization's records`, async () => {
      render(<LiveWorkforceSync />); // clears the demo stores at once, then loads
      const { unmount } = render(<MemoryRouter><Screen /></MemoryRouter>);
      await waitFor(() => expect(useLiveTimeMeta.getState().loaded).toBe(true));
      await waitFor(() => expect(useHr.getState().staff).toHaveLength(1));
      unmount();
      render(<MemoryRouter><Screen /></MemoryRouter>);
    });
  }
});

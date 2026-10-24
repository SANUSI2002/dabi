import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ workforceRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/emr-live/client")>()), workforceRequest: api.workforceRequest }));

import Timesheets from "@/pages/workforce/Timesheets";
import WorkTasks from "@/pages/workforce/WorkTasks";
import { useWorkforce } from "@/store/useWorkforce";
import { useHr } from "@/store/useHr";
import { wfScope } from "@/store/useWorkforceSession";
import { liveRouteState } from "@/emr-live/routes";
import { useLiveEmr } from "@/emr-live/session";
import { LiveWorkforceSync } from "./LiveWorkforceSync";
import { useWorkforceSync } from "./sync";

const time = {
  selfEmployeeId: "e1", reportIds: [], seesEveryone: false, currentPeriodId: "p1", timeZone: "Africa/Lagos", onLeaveToday: [],
  timeBlocks: [], schedules: [], assignments: [],
  attendance: [{ id: "a1", staffId: "e1", date: "2026-10-20", clockIn: "07:58", clockInAt: "2026-10-20T06:58:00.000Z", clockOutAt: null, source: "Web", breakMins: 0, flags: [], workLocation: "WFO", version: 2 }],
  periods: [{ id: "p1", label: "Oct 2026", start: "2026-10-01", end: "2026-10-31", locked: false, version: 1 }],
  timesheets: [{ id: "t1", staffId: "e1", periodId: "p1", status: "Open", captureMode: "Attendance", version: 0, rowVersion: 4, lines: [{ id: "derived-2026-10-19", date: "2026-10-19", source: "Attendance", expectedHours: 8, workedHours: 7.5, breakHours: 0.5, overtimeHours: 0 }], history: [] }],
  policies: [{ id: "po", scope: "Organisation default", effectiveFrom: "2026-10-01", periodType: "Monthly", captureDefault: "Attendance", incrementMins: 15, rounding: "None", submissionDeadlineDays: 3, approvalDeadlineDays: 5, lateGraceMins: 10, earlyLeaveGraceMins: 10, absenceThresholdMins: 240, maxDailyHours: 16, allowEditDerived: false, overtimeEnabled: true, status: "Current" }],
  settings: { capabilities: [{ key: "Attendance", enabled: true, note: "" }, { key: "Scheduling", enabled: true, note: "" }, { key: "Timesheets", enabled: true, note: "" }], breakRules: [], attendanceRules: [], enrolments: [], version: 3 },
  holidays: [], leave: [], holidayWork: [], overtime: [], amendments: [], containers: [], tasks: [], activities: [],
};
const directory = { employees: [{ id: "e1", name: "Grace Nwangbo", role: "Nurse", cadre: "", status: "ACTIVE", hireDate: "2024-03-01" }, { id: "e2", name: "Dr Bello", role: "Doctor", cadre: "", status: "ACTIVE", hireDate: "2020-01-01" }], departments: [] };

const signIn = (permissions: string[]) => useLiveEmr.setState({
  status: "ready", error: "", user: { id: "u1", name: "Grace Nwangbo", email: "grace@hospital.test", role: "Nurse" },
  access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["NURSE"], permissions, clinicalApiConnected: true, patientRegistryEnabled: true } as never,
});

beforeEach(() => {
  api.workforceRequest.mockReset();
  api.workforceRequest.mockImplementation(async (path: string) => (path === "/time" ? { data: time } : path === "/people/directory" ? { data: directory } : { data: {} }));
  useWorkforceSync.setState({ error: "", pending: 0 });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("live time & attendance", () => {
  it("connects the Workforce screens for every staff role", () => {
    expect(liveRouteState("/workforce", ["workforce.self"])).toBe("connected");
    expect(liveRouteState("/workforce/timesheets", ["workforce.self"])).toBe("connected");
    expect(liveRouteState("/hris", ["workforce.self"])).toBe("no-permission");
  });

  it("loads a nurse's own time and colleagues' names, and scopes the screens to her", async () => {
    signIn(["workforce.self", "workforce.directory"]);
    render(<LiveWorkforceSync />);
    await waitFor(() => expect(useWorkforce.getState().timesheets).toHaveLength(1));
    await waitFor(() => expect(useHr.getState().staff.map((s) => s.name)).toEqual(["Grace Nwangbo", "Dr Bello"]));
    const scope = wfScope();
    expect(scope).toMatchObject({ staffId: "e1", role: "Employee", canApprove: false, canConfigure: false, canRecordOwnTime: true, canViewAs: false, selfOnly: true });
    expect(scope.visibleIds).toEqual(["e1"]);
  });

  it("sends clock-out and submission to the API with the record's version", async () => {
    signIn(["workforce.self", "workforce.directory"]);
    render(<LiveWorkforceSync />);
    await waitFor(() => expect(useWorkforce.getState().timesheets).toHaveLength(1));
    useWorkforce.getState().clockOut("a1");
    useWorkforce.getState().setTimesheetStatus("t1", "Submitted", "Grace Nwangbo");
    useWorkforce.getState().requestLeave({ staffId: "e1", type: "Annual Leave", from: "2026-12-21", to: "2026-12-24", days: 4, paid: true });
    await waitFor(() => expect(api.workforceRequest).toHaveBeenCalledWith("/time/leave", expect.anything()));
    const writes = api.workforceRequest.mock.calls.filter(([, o]) => o?.method).map(([p, o]) => [p, o.version, o.body]);
    expect(writes).toEqual([
      ["/time/attendance/a1/clock-out", undefined, {}],
      ["/time/timesheets/t1/submit", 4, {}],
      ["/time/leave", undefined, { employeeId: "e1", type: "Annual Leave", from: "2026-12-21", to: "2026-12-24", days: 4, paid: true }],
    ]);
  });

  it("opens Timesheets and Work & Tasks before (and after) the records arrive", async () => {
    signIn(["workforce.self", "workforce.directory"]);
    useWorkforce.setState({ periods: [], timesheets: [], containers: [], tasks: [] });
    render(<MemoryRouter><Timesheets /><WorkTasks /></MemoryRouter>);
    render(<LiveWorkforceSync />);
    expect((await screen.findAllByText(/Oct 2026/)).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /New Task/ })).toBeDisabled(); // no work items yet in this organization
  });
});

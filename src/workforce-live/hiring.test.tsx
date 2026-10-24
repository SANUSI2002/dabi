import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ workforceRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/emr-live/client")>()), workforceRequest: api.workforceRequest }));

import Recruitment from "@/pages/hr/Recruitment";
import TalentPool from "@/pages/hr/TalentPool";
import Vacancies from "@/pages/hr/Vacancies";
import OnboardingHr from "@/pages/hr/Onboarding";
import Offboarding from "@/pages/hr/Offboarding";
import { useRecruitment } from "@/store/useRecruitment";
import { useOnboarding } from "@/store/useOnboarding";
import { useVacancies } from "@/store/useVacancies";
import { useIdentity } from "@/store/useIdentity";
import { liveRouteState } from "@/emr-live/routes";
import { useLiveEmr } from "@/emr-live/session";
import { LiveWorkforceSync } from "./LiveWorkforceSync";
import { useLiveHiringMeta } from "./hiring";
import { useWorkforceSync } from "./sync";

const R = "00000000-0000-4000-8000-0000000000r1".replace("r", "c");
const hiring = {
  selfEmployeeId: "e1", canManage: true, ledDepartmentIds: [],
  vacancies: [{ id: "v1", departmentId: "d1", roleTitle: "Lab Scientist", headcount: 1, reason: "Night cover", raisedBy: "e1", raisedByMe: true, status: "Draft", workflowRef: "v1", createdAt: "2026-10-20T08:00:00.000Z", version: 3 }],
  requisitions: [{ id: R, title: "Lab Scientist", description: "", departmentId: "d1", jobPositionId: "p1", vacancy: 1, managerIds: [], startDate: "2026-11-01", closed: false }],
  stages: ["Applied", "Screening", "Interview", "Hired"].map((name, sequence) => ({ id: `st${sequence}`, requisitionId: R, name, type: ["Applied", "Test", "Interview", "Hired"][sequence], sequence })),
  candidates: [{ id: "c1", requisitionId: R, stageId: "st3", name: "Ada Obi", email: "ada@applicant.test", phone: "", source: "Application", appliedAt: "2026-10-20T08:00:00.000Z", rating: 4, hired: false, canceled: false }],
  interviews: [], talentPool: [],
  onboarding: [{ id: "op1", candidateId: "c0", candidateName: "Bola Ade", requisitionId: R, jobPositionId: "p1", departmentId: "d1", currentStageId: "ob-st3", taskDone: { "ob-t8": true, "ob-t9": true }, startedAt: "2026-10-01T08:00:00.000Z", version: 4 }],
  onboardingDocuments: [], offerLetterTemplate: { text: "Dear {{candidate_name}}", version: 2 }, offboarding: [],
};
const workflows = { selfEmployeeId: "e1", canManage: true, connectedTriggers: ["vacancy", "onboarding"], defs: [], instances: [], inbox: [] };

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
  api.workforceRequest.mockReset();
  api.workforceRequest.mockImplementation(async (path: string) => (path === "/hiring" ? { data: hiring } : path === "/workflows" ? { data: workflows } : { data: {} }));
  useWorkforceSync.setState({ error: "", pending: 0 });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u1", name: "Ngozi Okafor", email: "hr@hospital.test", role: "HR Officer" },
    access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["HR_OFFICER"], permissions: ["hr.read", "hr.manage", "workforce.self", "workflow.manage"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

const writes = () => api.workforceRequest.mock.calls.filter(([, o]) => o?.method).map(([p, o]) => [p, o.method, o.body, o.version]);

describe("live hiring and exits", () => {
  it("connects the hiring screens for HR, and vacancy requests for every staff role", () => {
    expect(liveRouteState("/hr/recruitment", ["hr.read"])).toBe("connected");
    expect(liveRouteState("/hr/onboarding", ["workforce.self"])).toBe("no-permission");
    expect(liveRouteState("/hr/vacancies", ["workforce.self"])).toBe("connected");
  });

  it("opens every hiring screen with the organization's records, as the signed-in person", async () => {
    render(<LiveWorkforceSync />);
    await waitFor(() => expect(useLiveHiringMeta.getState().loaded).toBe(true));
    expect(useIdentity.getState().user).toMatchObject({ id: "e1", name: "Ngozi Okafor" });
    for (const Screen of [Recruitment, TalentPool, Vacancies, OnboardingHr, Offboarding]) {
      const { unmount } = render(<MemoryRouter><Screen /></MemoryRouter>);
      unmount();
    }
    render(<MemoryRouter><Recruitment /></MemoryRouter>);
    expect(await screen.findByText("Ada Obi")).toBeInTheDocument();
  });

  it("hires into onboarding and submits a vacancy to its approval workflow", async () => {
    render(<LiveWorkforceSync />);
    await waitFor(() => expect(useLiveHiringMeta.getState().loaded).toBe(true));
    useRecruitment.getState().hireCandidate("c1");
    useOnboarding.getState().startOnboarding({ candidateId: "c1", candidateName: "Ada Obi", requisitionId: R, jobPositionId: "p1", departmentId: "d1" });
    expect(useVacancies.getState().submitVacancy("v1")).toEqual({ ok: true });
    useVacancies.getState().updateVacancy("v1", { headcount: 2 });
    await waitFor(() => expect(writes().length).toBe(4));
    expect(writes()).toEqual([
      ["/hiring/candidates/c1/hire", "POST", {}, undefined],
      ["/hiring/onboarding", "POST", { id: expect.any(String), candidateId: "c1" }, undefined],
      ["/workflows/instances", "POST", { triggerType: "vacancy", reference: "v1" }, undefined],
      ["/hiring/vacancies/v1", "PATCH", { headcount: 2 }, 3],
    ]);
  });

  it("sends a typed salary once, and converts to the employee id it returns", async () => {
    render(<LiveWorkforceSync />);
    await waitFor(() => expect(useLiveHiringMeta.getState().loaded).toBe(true));
    vi.useFakeTimers();
    for (const amount of [3, 32, 320, 320000]) useOnboarding.getState().setBasicSalary("op1", amount);
    vi.advanceTimersByTime(700);
    vi.useRealTimers();
    const id = useOnboarding.getState().convertToEmployee("op1", "Lab Scientist", "GL 08");
    await waitFor(() => expect(writes().length).toBe(2));
    expect(writes()).toEqual([
      ["/hiring/onboarding/op1", "PATCH", { basicSalary: 320000 }, undefined],
      ["/hiring/onboarding/op1/convert", "POST", { employeeId: id, role: "Lab Scientist", cadre: "GL 08" }, undefined],
    ]);
  });
});

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ workforceRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/emr-live/client")>()), workforceRequest: api.workforceRequest }));

import Performance from "@/pages/hr/Performance";
import Promotions from "@/pages/hr/Promotions";
import BranchTransfers from "@/pages/hr/BranchTransfers";
import { usePerformance } from "@/store/usePerformance";
import { usePromotions } from "@/store/usePromotions";
import { liveRouteState } from "@/emr-live/routes";
import { useLiveEmr } from "@/emr-live/session";
import { LiveWorkforceSync } from "./LiveWorkforceSync";
import { useLiveCareersMeta } from "./careers";
import { useWorkforceSync } from "./sync";

const careers = {
  selfEmployeeId: "e1", periods: [], keyResults: [{ id: "k1", title: "Patients or clients reached", type: "Numeric", targetValue: 40 }],
  objectives: [{ id: "o1", title: "Postpartum FP uptake", description: "Counsel PNC clients", managerIds: ["e2"], assigneeIds: ["e1"], keyResultIds: ["k1"], durationUnit: "Months", duration: 3 }],
  employeeObjectives: [{ id: "eo1", objectiveId: "o1", employeeId: "e1", startDate: "2026-10-01T00:00:00.000Z", endDate: "2026-12-30T00:00:00.000Z", status: "On Track", progressPercentage: 50, keyResults: [{ id: "x1", keyResultId: "k1", title: "Patients or clients reached", type: "Numeric", currentValue: 20, targetValue: 40 }] }],
  feedbacks: [{ id: "f1", reviewCycle: "Q4 2026", employeeId: "e1", managerId: "e2", colleagueIds: [], status: "In Progress", startDate: "2026-10-20T08:00:00.000Z", selfAnswers: null, managerAnswers: null }],
  meetings: [], transfers: [],
  promotions: [{ id: "p1", employeeId: "e1", toCadre: "GL 10", effectiveDate: "2026-12-01", reason: "Ward leadership", status: "Proposed", createdAt: "2026-10-20T08:00:00.000Z", handoverStatus: "Not started" }],
};
const workflows = { selfEmployeeId: "e9", canManage: true, connectedTriggers: ["promotion", "transfer"], defs: [], instances: [], inbox: [] };

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
  api.workforceRequest.mockReset();
  api.workforceRequest.mockImplementation(async (path: string) => (path === "/careers" ? { data: careers } : path === "/workflows" ? { data: workflows } : { data: {} }));
  useWorkforceSync.setState({ error: "", pending: 0 });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u9", name: "Ngozi Okafor", email: "hr@hospital.test", role: "HR Officer" },
    access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["HR_OFFICER"], permissions: ["hr.read", "hr.manage", "workforce.self", "workflow.manage"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });
const writes = () => api.workforceRequest.mock.calls.filter(([, o]) => o?.method).map(([p, o]) => [p, o.body]);

describe("live careers", () => {
  it("connects Performance for every staff role, promotions and transfers for HR", () => {
    expect(liveRouteState("/hr/performance", ["workforce.self"])).toBe("connected");
    expect(liveRouteState("/hr/promotions", ["workforce.self"])).toBe("no-permission");
    expect(liveRouteState("/hr/branch-transfers", ["hr.read"])).toBe("connected");
  });

  it("opens the careers screens with the organization's records", async () => {
    render(<LiveWorkforceSync />);
    await waitFor(() => expect(useLiveCareersMeta.getState().loaded).toBe(true));
    for (const Screen of [Promotions, BranchTransfers]) {
      const { unmount } = render(<MemoryRouter><Screen /></MemoryRouter>);
      unmount();
    }
    render(<MemoryRouter><Performance /></MemoryRouter>);
    expect(await screen.findByText("Postpartum FP uptake")).toBeInTheDocument();
  });

  it("sends reviews, proposals and resubmissions to the API", async () => {
    render(<LiveWorkforceSync />);
    await waitFor(() => expect(useLiveCareersMeta.getState().loaded).toBe(true));
    usePerformance.getState().submitFeedback("f1", "self", [{ question: "Communicates effectively", rating: 4, comment: " " }]);
    const id = usePromotions.getState().propose({ employeeId: "e1", toCadre: "GL 11", newSalary: 480000, effectiveDate: "2027-01-01T00:00:00.000Z", reason: "Leadership", requestedBy: "e9" });
    usePromotions.getState().resubmit("p1", "e9");
    usePromotions.getState().applyPromotion("p1");
    await waitFor(() => expect(writes()).toHaveLength(4));
    expect(writes()).toEqual([
      ["/careers/feedback/f1/answers", { role: "self", answers: [{ question: "Communicates effectively", rating: 4 }] }],
      ["/careers/promotions", { id, employeeId: "e1", toCadre: "GL 11", newSalary: 480000, effectiveDate: "2027-01-01", reason: "Leadership" }],
      ["/workflows/instances", { triggerType: "promotion", reference: "p1" }],
      ["/careers/promotions/p1/apply", {}],
    ]);
  });
});

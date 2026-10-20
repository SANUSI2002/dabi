import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ workforceRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/emr-live/client")>()), workforceRequest: api.workforceRequest }));

import CompanyAssets from "@/pages/hr/CompanyAssets";
import Helpdesk from "@/pages/hr/Helpdesk";
import PoliciesDiscipline from "@/pages/hr/PoliciesDiscipline";
import { useHelpdesk } from "@/store/useHelpdesk";
import { useQueries } from "@/store/useQueries";
import { useCompanyAssets } from "@/store/useCompanyAssets";
import { liveRouteState } from "@/emr-live/routes";
import { useLiveEmr } from "@/emr-live/session";
import { LiveWorkforceSync } from "./LiveWorkforceSync";
import { useLiveServicesMeta } from "./services";
import { useWorkforceSync } from "./sync";

const services = {
  selfEmployeeId: "e1", categories: [{ id: "c1", name: "Laptops", description: "" }],
  assets: [{ id: "a1", name: "ThinkPad T14", categoryId: "c1", trackingId: "LT-001", purchaseDate: "2026-01-10", purchaseCost: 950000, status: "Available" }],
  requests: [], allocations: [],
  tickets: [{ id: "t1", seq: 7, type: "IT Support", title: "EMR login fails", description: "Reset link expired", raisedBy: "e1", assigningType: "Department", raisedOn: "Records & HMIS", assignedTo: [], priority: 3, status: "New", createdAt: "2026-10-20T08:00:00.000Z" }],
  faqCategories: [{ id: "fc1", name: "IT & Systems" }], faqs: [], queries: [],
};

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
  api.workforceRequest.mockReset();
  api.workforceRequest.mockImplementation(async (path: string) => (path === "/services" ? { data: services } : { data: {} }));
  useWorkforceSync.setState({ error: "", pending: 0 });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u1", name: "Ngozi Okafor", email: "hr@hospital.test", role: "HR Officer" },
    access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["HR_OFFICER"], permissions: ["hr.read", "hr.manage", "workforce.self"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });
const writes = () => api.workforceRequest.mock.calls.filter(([, o]) => o?.method).map(([p, o]) => [p, o.body]);

describe("live HR services", () => {
  it("connects the helpdesk for everyone, assets and discipline for HR", () => {
    expect(liveRouteState("/hr/helpdesk", ["workforce.self"])).toBe("connected");
    expect(liveRouteState("/hr/assets", ["workforce.self"])).toBe("no-permission");
    expect(liveRouteState("/hr/policies-discipline", ["hr.read"])).toBe("connected");
  });

  it("opens the screens with the organization's records and sends their actions", async () => {
    render(<LiveWorkforceSync />);
    await waitFor(() => expect(useLiveServicesMeta.getState().loaded).toBe(true));
    for (const Screen of [CompanyAssets, PoliciesDiscipline]) {
      const { unmount } = render(<MemoryRouter><Screen /></MemoryRouter>);
      unmount();
    }
    render(<MemoryRouter><Helpdesk /></MemoryRouter>);
    expect((await screen.findAllByText("EMR login fails")).length).toBeGreaterThan(0);
    expect(useHelpdesk.getState().ticketCode(useHelpdesk.getState().tickets[0])).toBe("ITS-1007");
    useHelpdesk.getState().createTicket({ type: "Facilities", title: "Fridge alarm", description: "EPI fridge", raisedBy: "ignored", assigningType: "Department", raisedOn: "Nursing", priority: 3 });
    useCompanyAssets.getState().allocateAsset("a1", "e2");
    const id = useQueries.getState().raiseQuery({ employeeId: "e2", raisedBy: "e1", subject: "Lateness", body: "Late three times", responseDeadlineDays: 3 });
    await waitFor(() => expect(writes()).toHaveLength(3));
    expect(writes()).toEqual([
      ["/services/tickets", { id: expect.any(String), type: "Facilities", title: "Fridge alarm", description: "EPI fridge", assigningType: "Department", raisedOn: "Nursing", priority: 3 }],
      ["/services/allocations", { assetId: "a1", employeeId: "e2" }],
      ["/services/queries", { id, employeeId: "e2", subject: "Lateness", body: "Late three times", responseDeadlineDays: 3 }],
    ]);
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ accountingRequest: vi.fn(), workforceRequest: vi.fn(), orgConfigRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/emr-live/client")>()), ...api }));

import Integrations from "@/pages/accounting/Integrations";
import { useIntegrations } from "@/store/useIntegrations";
import { useLiveEmr } from "@/emr-live/session";
import { LiveWorkforceSync } from "@/workforce-live/LiveWorkforceSync";
import { useWorkforceSync } from "@/workforce-live/sync";
import { useLiveIntegrationsMeta } from "./integrations";

const status = { pending: { emrBilling: 3, payrollAccrual: 1, payrollSettlement: 0, pharmacy: 2, stores: 4 }, lastSyncAt: null };
const synced = { pending: { emrBilling: 0, payrollAccrual: 0, payrollSettlement: 0, pharmacy: 1, stores: 0 }, lastSyncAt: "2026-10-20T12:00:00.000Z",
  results: [{ module: "EMR Billing", created: 3, skipped: 0, errors: [] }, { module: "Payroll", created: 1, skipped: 0, errors: [] }, { module: "Pharmacy", created: 1, skipped: 1, errors: ["Batch B-9 has no unit cost recorded; its dispense was not costed"] }] };

const signIn = (permissions: string[]) => useLiveEmr.setState({
  status: "ready", error: "", user: { id: "u1", name: "Ngozi Eze", email: "finance@hospital.test", role: "Finance Officer" },
  access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["FINANCE_OFFICER"], permissions, clinicalApiConnected: true, patientRegistryEnabled: true } as never,
});
beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
  for (const fn of Object.values(api)) fn.mockReset();
  api.accountingRequest.mockImplementation(async (path: string, o?: { method?: string }) => ({ data: path === "/integrations/sync" && o?.method === "POST" ? synced : path === "/integrations" ? status : {} }));
  api.workforceRequest.mockResolvedValue({ data: {} });
  api.orgConfigRequest.mockResolvedValue({ data: {} });
  useWorkforceSync.setState({ error: "", pending: 0 });
  useIntegrations.setState({ autoSync: false, results: [] });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });
const syncs = () => api.accountingRequest.mock.calls.filter(([p, o]) => p === "/integrations/sync" && o?.method === "POST").map(([, o]) => o.body);

describe("live integrations", () => {
  it("shows what the server still has to post, and runs the sync there", async () => {
    signIn(["acct.view", "acct.post"]);
    render(<LiveWorkforceSync />);
    await waitFor(() => expect(useLiveIntegrationsMeta.getState().loaded).toBe(true));
    render(<MemoryRouter><Integrations /></MemoryRouter>);
    expect(screen.getByText("3 pending")).toBeInTheDocument();
    expect(screen.getByText("4 pending")).toBeInTheDocument(); // the stores connector
    fireEvent.click(screen.getByText("Sync now"));
    await waitFor(() => expect(syncs()).toEqual([{ modules: ["EMR Billing", "Payroll", "Pharmacy", "Stores"] }]));
    expect(await screen.findByText(/has no unit cost recorded/)).toBeInTheDocument();
  });

  it("auto-syncs on load for someone who may post, and never for a viewer", async () => {
    useIntegrations.setState({ autoSync: true });
    signIn(["acct.view"]);
    const viewer = render(<LiveWorkforceSync />);
    await waitFor(() => expect(useLiveIntegrationsMeta.getState().loaded).toBe(true));
    expect(syncs()).toEqual([]);
    viewer.unmount();
    signIn(["acct.view", "acct.post"]);
    render(<LiveWorkforceSync />);
    await waitFor(() => expect(syncs()).toEqual([{ modules: ["EMR Billing", "Payroll", "Pharmacy", "Stores"] }]));
  });
});

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ accountingRequest: vi.fn(), workforceRequest: vi.fn(), orgConfigRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/emr-live/client")>()), ...api }));

import AuditTrail from "@/pages/accounting/AuditTrail";
import { useAudit } from "@/store/useAudit";
import { useLiveEmr } from "@/emr-live/session";
import { loadAcctAudit } from "./audit";
import { loadHrAudit } from "@/workforce-live/audit";

const event = (id: string, at: string, action: string, extra: object) => ({ id, at, action, resourceId: id, changedFields: [], actorName: "Ngozi Eze", actorRoles: ["FINANCE_OFFICER"], ...extra });

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  api.accountingRequest.mockResolvedValue({ data: { items: [event("a1", "2026-10-20T10:00:00.000Z", "bill.posted", { module: "bills", resourceType: "bill" })] } });
  api.workforceRequest.mockResolvedValue({ data: { items: [event("h1", "2026-10-20T11:00:00.000Z", "employee.updated", { resourceType: "employee" })] } });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u1", name: "Ngozi Eze", email: "finance@hospital.test", role: "Finance Officer" },
    access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["FINANCE_OFFICER"], permissions: ["acct.view"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("live accounting audit trail", () => {
  it("shows the organization's trail, keeps the HR trail beside it, and drops the demo's own events", async () => {
    expect(useAudit.getState().events.length).toBeGreaterThan(0); // the demo seed
    await loadHrAudit();
    await loadAcctAudit();
    await loadHrAudit(); // reloading one trail keeps the other
    expect(useAudit.getState().events.map((e) => e.id)).toEqual(["h1", "a1"]);
    render(<MemoryRouter><AuditTrail /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("BILL POSTED")).toBeInTheDocument());
    expect(screen.getByText("bills/a1")).toBeInTheDocument();
    expect(screen.queryByText("EMPLOYEE UPDATED")).not.toBeInTheDocument(); // HR's stays off the Accounting screen
  });
});

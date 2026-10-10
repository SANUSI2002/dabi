import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ emrRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("./client")>()), emrRequest: api.emrRequest }));

import { Sidebar } from "@/components/layout/Sidebar";
import { EntitlementBoundary } from "@/platform/EntitlementBoundary";
import { useLiveEmr } from "./session";

const ORG = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  api.emrRequest.mockResolvedValue({ data: { items: [] } });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u1", name: "Tunde Bakare", email: "doctor@hospital.test", role: "Doctor" },
    access: { organizationId: ORG, facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["DOCTOR"], permissions: ["queue.read", "patient.read"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("a live hospital's navigation", () => {
  it("keeps every module in the menu, not just the EMR", () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    for (const group of ["Clinical", "Human Resources", "Accounting", "Workforce", "Administration"]) {
      expect(screen.getByText(group)).toBeTruthy();
    }
    expect(screen.getByText("Employee Directory")).toBeTruthy();
    expect(screen.getByText("General Ledger")).toBeTruthy();
  });

  it("opens a module without live records on a plain notice, never sample data", () => {
    render(<MemoryRouter initialEntries={["/hr/employees"]}><EntitlementBoundary><p>Sample employees</p></EntitlementBoundary></MemoryRouter>);
    expect(screen.getByText("Not connected yet")).toBeTruthy();
    expect(screen.queryByText("Sample employees")).toBeNull();
  });
});

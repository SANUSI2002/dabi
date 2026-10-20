import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ emrRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("./client")>()), emrRequest: api.emrRequest }));

import Equipment from "@/pages/admin/Equipment";
import { assetFromApi, jobFromApi, useLiveEquipment, type ApiAsset, type ApiJob } from "./equipment";
import { liveRouteState } from "./routes";
import { useLiveEmr } from "./session";

const fridge: ApiAsset = { id: "a1", tag: "VR-8890", name: "Vaccine refrigerator", category: "Cold chain", location: "EPI room", status: "UNDER_REPAIR", serialNumber: "HBC-1", costMinor: 38000000, commissionedOn: "2024-01-01", serviceIntervalDays: 90, lastServicedOn: "2026-07-01", version: 4 };
const job: ApiJob = { id: "j1", assetId: "a1", type: "CORRECTIVE", summary: "Not cooling", priority: "HIGH", status: "IN_PROGRESS", version: 2, reportedByName: "Grace Nwangbo", openedAt: "2026-10-19T08:00:00.000Z", closedAt: null, resolution: null };

beforeEach(() => {
  api.emrRequest.mockReset();
  api.emrRequest.mockImplementation(async (path: string) => (path === "/equipment" ? { data: { assets: [fridge], jobs: [job] } } : { data: {} }));
  useLiveEquipment.setState({ assets: [], jobs: [], error: "" });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u7", name: "Store Officer", email: "stores@hospital.test", role: "Inventory Officer" },
    access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["INVENTORY_OFFICER"], permissions: ["equipment.read", "equipment.report", "equipment.manage"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("live equipment and maintenance", () => {
  it("is connected and maps the register", () => {
    expect(liveRouteState("/equipment", ["equipment.read"])).toBe("connected");
    expect(assetFromApi(fridge)).toMatchObject({ status: "Under repair", cost: 380000, serialNumber: "HBC-1" });
    expect(jobFromApi(job)).toMatchObject({ type: "Corrective", priority: "High", status: "In Progress", reportedBy: "Grace Nwangbo" });
  });

  it("resolves a job in the hospital's EMR", async () => {
    render(<MemoryRouter><Equipment /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("tab", { name: "Maintenance Jobs" }));
    fireEvent.click(await screen.findByRole("button", { name: "Resolve" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Replaced thermostat" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Mark resolved/ }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/equipment/jobs/j1/resolve", { method: "POST", version: 2, body: { resolution: "Replaced thermostat" } }));
  });

  it("reports a fault for a registered asset", async () => {
    render(<MemoryRouter><Equipment /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Report fault/ }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getAllByRole("option").length).toBeGreaterThan(1));
    fireEvent.change(within(dialog).getAllByRole("combobox")[0], { target: { value: "a1" } });
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Door seal torn" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/equipment/faults", expect.objectContaining({ method: "POST", body: { assetId: "a1", summary: "Door seal torn", priority: "MEDIUM" } })));
  });
});

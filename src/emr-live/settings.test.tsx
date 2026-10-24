import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ emrRequest: vi.fn(), identity: vi.fn(), invite: vi.fn(), roles: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("./client")>()), emrRequest: api.emrRequest }));
vi.mock("@/identity/liveIdentity", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/identity/liveIdentity")>()), liveApiRequest: api.identity, liveCreateInvitation: api.invite, liveInvitationRoles: api.roles }));

import Settings from "@/pages/admin/Settings";
import { liveRouteState } from "./routes";
import { useLiveEmr } from "./session";

const ORG = "11111111-1111-4111-8111-111111111111";
const formulary = [{ code: "AL20_120", genericName: "Artemether/lumefantrine", form: "Tablet", strength: "20/120 mg", drugClasses: ["ANTIMALARIAL"], category: null, reorderLevel: 240, active: true, version: 3 }];

beforeEach(() => {
  api.emrRequest.mockReset(); api.identity.mockReset(); api.invite.mockReset(); api.roles.mockReset();
  api.emrRequest.mockImplementation(async (path: string) => {
    if (path.startsWith("/pharmacy/formulary?")) return { data: { items: formulary } };
    if (path.startsWith("/catalogs/vaccines")) return { data: { items: [{ code: "PENTA1", name: "Pentavalent Vaccine (Dose 1)", ageWeeks: 6 }], editable: false } };
    if (path.startsWith("/catalogs/categories")) return { data: { items: [{ id: "c1", code: "U5", name: "Under-5", exempt: true, reason: "Free child health", active: true, version: 1 }] } };
    return { data: {} };
  });
  api.identity.mockResolvedValue({ data: { items: [{ id: "m1", status: "ACTIVE", user: { id: "u1", email: "grace@hospital.test", full_name: "Grace Nwangbo" }, roles: [{ roleCode: "NURSE" }] }] } });
  api.roles.mockResolvedValue({ data: { roles: ["NURSE", "DOCTOR"] } });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u9", name: "Folake Adeyemi", email: "admin@hospital.test", role: "Hospital Admin" },
    access: { organizationId: ORG, facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["HOSPITAL_ADMIN"], permissions: ["catalog.manage", "emr.formulary.manage", "membership.read", "immunization.read"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("live settings", () => {
  it("connects Settings but leaves the platform tools under it alone", () => {
    expect(liveRouteState("/settings", ["catalog.manage"])).toBe("connected");
    expect(liveRouteState("/settings/workflows", ["catalog.manage"])).toBe("no-permission"); // the Workflow Builder needs workflow.manage
    expect(liveRouteState("/settings/workflows", ["workflow.manage"])).toBe("connected");
    expect(liveRouteState("/settings/letters", ["catalog.manage"])).toBe("no-permission"); // letter templates are HR's
    expect(liveRouteState("/settings/master-data", ["catalog.manage"])).toBe("connected"); // EMR lists
  });

  it("lists and edits the hospital's formulary", async () => {
    render(<MemoryRouter><Settings /></MemoryRouter>);
    expect(await screen.findByText("Artemether/lumefantrine")).toBeInTheDocument();
    expect(screen.getByText("Antimalarial")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Edit/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("spinbutton"), { target: { value: "300" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/pharmacy/formulary/AL20_120", expect.objectContaining({ method: "PATCH", version: 3, body: expect.objectContaining({ reorderLevel: 300 }) })));
  });

  it("shows the national schedule read-only and refuses edits with the reason", async () => {
    render(<MemoryRouter><Settings /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Vaccines" }));
    expect(await screen.findByText("Pentavalent Vaccine (Dose 1)")).toBeInTheDocument();
    expect(screen.getAllByText(/national \(NPHCDA\)/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    expect((await screen.findAllByRole("alert")).some((a) => /cannot be edited/.test(a.textContent ?? ""))).toBe(true);
  });

  it("invites a user with a role by email", async () => {
    render(<MemoryRouter><Settings /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Users" }));
    expect(await screen.findByText("Grace Nwangbo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Add User/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "new.nurse@hospital.test" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(api.invite).toHaveBeenCalledWith("new.nurse@hospital.test", "NURSE", ORG));
  });
});

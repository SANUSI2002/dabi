import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ orgConfigRequest: vi.fn(), workforceRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/emr-live/client")>()), orgConfigRequest: api.orgConfigRequest, workforceRequest: api.workforceRequest }));

import PlatformModules from "@/pages/platform/PlatformModules";
import { LiveRouteBoundary } from "@/emr-live/shell";
import { useEntitlements } from "@/platform/useEntitlements";
import { useLiveEmr } from "@/emr-live/session";
import { LiveWorkforceSync } from "./LiveWorkforceSync";
import { useLiveModulesMeta } from "./modules";
import { useWorkforceSync } from "./sync";

const mod = (key: string, product: string, enabled: boolean, submodules: { key: string; enabled: boolean }[] = []) => ({ key, product, label: key, core: false, licensed: product === "emr", enabled, submodules });
const modules = {
  package: { name: "Hospital Standard", version: 3 },
  products: { emr: true, workforce: false, accounting: false },
  modules: [mod("emr.clinical", "emr", true), mod("emr.laboratory", "emr", false), mod("emr.radiology", "emr", true), mod("workforce.core", "workforce", false), mod("workforce.payroll", "workforce", false)],
  disabled: ["emr.laboratory"], version: 2, editable: true,
};

const signIn = (permissions: string[]) => useLiveEmr.setState({
  status: "ready", error: "", user: { id: "u1", name: "Folake Adeyemi", email: "admin@hospital.test", role: "Hospital Admin" },
  access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["HOSPITAL_ADMIN"], permissions, clinicalApiConnected: true, patientRegistryEnabled: true } as never,
});
beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
  api.orgConfigRequest.mockReset();
  api.orgConfigRequest.mockImplementation(async (path: string) => ({ data: path === "/modules" ? modules : { data: {}, terms: { overrides: {}, version: 0 }, templates: [], letters: [] } }));
  api.workforceRequest.mockReset();
  api.workforceRequest.mockResolvedValue({ data: {} });
  useWorkforceSync.setState({ error: "", pending: 0 });
  signIn(["platform.config", "lab.order.read"]);
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });
const writes = () => api.orgConfigRequest.mock.calls.filter(([, o]) => o?.method).map(([p, o]) => [p, o.method, o.body, o.version]);
const ready = async () => { render(<LiveWorkforceSync />); await waitFor(() => expect(useLiveModulesMeta.getState().loaded).toBe(true)); };
const at = (path: string) => render(<MemoryRouter><LiveRouteBoundary pathname={path}><p>the screen</p></LiveRouteBoundary></MemoryRouter>);

describe("live module switches", () => {
  it("takes products from the package and modules from the organization's switches", async () => {
    await ready();
    expect(useEntitlements.getState().products).toEqual({ emr: true, workforce: false, accounting: false, pharmacy: false });
    expect(useEntitlements.getState().org).toMatchObject({ name: "Sabi Test General Hospital", slug: "sabi-test-general-hospital", plan: "Hospital Standard" });
    render(<MemoryRouter><PlatformModules /></MemoryRouter>);
    expect(screen.getByText("Hospital Standard (v3)")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Laboratory off" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "All modules" })).toBeDisabled(); // products are the package's
  });

  it("says a switched-off screen is switched off, and a product outside the package is not included", async () => {
    await ready();
    at("/laboratory");
    expect(screen.getByText("Switched off")).toBeInTheDocument();
    expect(screen.queryByText("the screen")).toBeNull();
    cleanup();
    at("/hr/payroll");
    expect(screen.getByText("Not part of your package")).toBeInTheDocument();
    cleanup();
    at("/platform");
    expect(screen.getByText("the screen")).toBeInTheDocument();
  });

  it("saves a switch for the whole organization, version-checked", async () => {
    await ready();
    useEntitlements.getState().setModule("emr.radiology", false);
    expect(useEntitlements.getState().isModuleEnabled("emr.radiology")).toBe(false); // at once, then from the server
    await waitFor(() => expect(writes()).toContainEqual(["/modules", "PUT", { disabled: ["emr.laboratory", "emr.radiology"] }, 2]));
  });

  it("lets everyone read the switches but only an administrator change them", async () => {
    api.orgConfigRequest.mockImplementation(async (path: string) => ({ data: path === "/modules" ? { ...modules, editable: false } : { data: {}, terms: { overrides: {}, version: 0 }, templates: [], letters: [] } }));
    signIn(["lab.order.read"]);
    await ready();
    render(<MemoryRouter><PlatformModules /></MemoryRouter>);
    expect(screen.getByText(/Only a hospital administrator can switch modules/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Radiology on" })).toBeDisabled();
  });
});

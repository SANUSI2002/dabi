import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ orgConfigRequest: vi.fn(), workforceRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/emr-live/client")>()), orgConfigRequest: api.orgConfigRequest, workforceRequest: api.workforceRequest }));

import MasterDataSettings from "@/pages/platform/MasterDataSettings";
import TerminologySettings from "@/pages/platform/TerminologySettings";
import LetterTemplates from "@/pages/platform/LetterTemplates";
import { useMasterData } from "@/platform/useMasterData";
import { useTerminology } from "@/platform/useTerminology";
import { useLetters } from "@/platform/useLetters";
import { useLiveEmr } from "@/emr-live/session";
import { LiveWorkforceSync } from "./LiveWorkforceSync";
import { useLiveOrgConfigMeta } from "./orgConfig";
import { useWorkforceSync } from "./sync";

const config = {
  data: { "leave-types": [{ id: "i1", label: "Annual Leave", code: "ANNUAL", active: true, system: true, version: 3 }] },
  terms: { overrides: { hod: { singular: "Unit Head" } }, version: 2 },
  templates: [{ key: "missing-document", name: "Outstanding Document Notice", category: "Onboarding", body: "Dear {{employee_name}}, bring {{document_list}}.", signatories: ["HR"], active: true, version: 4 }],
  letters: [],
};

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
  api.orgConfigRequest.mockReset();
  api.orgConfigRequest.mockImplementation(async (path: string) => (path === "" ? { data: config } : { data: {} }));
  api.workforceRequest.mockReset();
  api.workforceRequest.mockResolvedValue({ data: {} });
  useWorkforceSync.setState({ error: "", pending: 0 });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u1", name: "Folake Adeyemi", email: "admin@hospital.test", role: "Hospital Admin" },
    access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["HOSPITAL_ADMIN"], permissions: ["platform.config", "hr.manage"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });
const writes = () => api.orgConfigRequest.mock.calls.filter(([, o]) => o?.method).map(([p, o]) => [p, o.method, o.body, o.version]);

describe("live organization configuration", () => {
  it("shows the organization's lists, terms and templates", async () => {
    render(<LiveWorkforceSync />);
    await waitFor(() => expect(useLiveOrgConfigMeta.getState().loaded).toBe(true));
    expect(useTerminology.getState().label("hod")).toBe("Unit Head");
    for (const Screen of [TerminologySettings, LetterTemplates]) {
      const { unmount } = render(<MemoryRouter><Screen /></MemoryRouter>);
      unmount();
    }
    render(<MemoryRouter><MasterDataSettings /></MemoryRouter>);
    expect(await screen.findByDisplayValue("Annual Leave")).toBeInTheDocument();
  });

  it("sends typed changes once, with their versions, and logs generated letters", async () => {
    render(<LiveWorkforceSync />);
    await waitFor(() => expect(useLiveOrgConfigMeta.getState().loaded).toBe(true));
    vi.useFakeTimers();
    for (const label of ["A", "An", "Annual leave"]) useMasterData.getState().updateItem("leave-types", "i1", { label });
    useTerminology.getState().setTerm("hod", { plural: "Unit Heads" });
    vi.advanceTimersByTime(700);
    vi.useRealTimers();
    const id = useLetters.getState().generate({ templateKey: "missing-document", data: { employee_name: "Ada Obi" }, reference: "onb-1" });
    expect(useLetters.getState().letterById(id!)?.rendered).toBe("Dear Ada Obi, bring ________.");
    await waitFor(() => expect(writes()).toHaveLength(3));
    expect(writes()).toEqual([
      ["/master-data/leave-types/i1", "PATCH", { label: "Annual leave" }, 3],
      ["/terminology", "PUT", { overrides: { hod: { singular: "Unit Head", plural: "Unit Heads" } } }, 2],
      ["/letters", "POST", { id, templateKey: "missing-document", title: "Outstanding Document Notice", data: { employee_name: "Ada Obi" }, reference: "onb-1" }, undefined],
    ]);
  });
});

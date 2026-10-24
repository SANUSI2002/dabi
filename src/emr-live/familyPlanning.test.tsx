import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ emrRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("./client")>()), emrRequest: api.emrRequest }));

import FamilyPlanning from "@/pages/mch/FamilyPlanning";
import { fpFromApi, useLiveFamilyPlanning, visitTypeCode, type ApiFpClient } from "./familyPlanning";
import { liveRouteState } from "./routes";
import { useLiveEmr } from "./session";

const woman = { id: "p1", medicalRecordNumber: "MRN-0000004", givenName: "Halima", familyName: "Bello", dateOfBirth: "1994-05-02", sex: "FEMALE" as const };
const client: ApiFpClient = {
  id: "f1", patientId: "p1", patient: woman, version: 2, method: "Implant", firstTime: true, startDate: "2026-08-01", nextVisitDate: "2027-08-01", counselled: true, notes: null,
  status: "ACTIVE", discontinueReason: null, registeredByName: "Grace Nwangbo",
  visits: [{ id: "v1", visitDate: "2026-08-01", visitType: "NEW_VISIT", method: "Implant", nextVisitDate: "2027-08-01", notes: null, recordedByName: "Grace Nwangbo" }],
};

beforeEach(() => {
  api.emrRequest.mockReset();
  api.emrRequest.mockImplementation(async (path: string) => (path.startsWith("/family-planning?") ? { data: { items: [client] } } : { data: {} }));
  useLiveFamilyPlanning.setState({ clients: [], error: "" });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u3", name: "Grace Nwangbo", email: "nurse@hospital.test", role: "Nurse" },
    access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["NURSE"], permissions: ["fp.read", "fp.manage", "patient.read"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("live family planning", () => {
  it("is connected, and maps the hospital's record", () => {
    expect(liveRouteState("/family-planning", ["fp.read"])).toBe("connected");
    expect(fpFromApi(client)).toMatchObject({ status: "Active", nextVisit: "2027-08-01", visits: [{ type: "New Visit", by: "Grace Nwangbo" }] });
    expect(visitTypeCode("Switch method")).toBe("SWITCH_METHOD");
  });

  it("switches a client's method on the hospital's record", async () => {
    render(<MemoryRouter><FamilyPlanning /></MemoryRouter>);
    expect(await screen.findByText("Halima Bello")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Visit/ }));
    const dialog = await screen.findByRole("dialog");
    const [type, method] = within(dialog).getAllByRole("combobox");
    fireEvent.change(type, { target: { value: "Switch method" } });
    fireEvent.change(method, { target: { value: "IUCD" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save visit" }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/family-planning/f1/visits", { method: "POST", version: 2, body: { visitType: "SWITCH_METHOD", method: "IUCD" } }));
  });
});

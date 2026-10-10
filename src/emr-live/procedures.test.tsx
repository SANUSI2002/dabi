import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ emrRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("./client")>()), emrRequest: api.emrRequest }));

import Procedures from "@/pages/clinical/Procedures";
import { procedureFromApi, useLiveProcedures, type ApiProcedure } from "./procedures";
import { liveRouteState } from "./routes";
import { useLiveEmr } from "./session";

const ORG = "11111111-1111-4111-8111-111111111111";
const patient = { id: "p1", medicalRecordNumber: "MRN-0000001", givenName: "Amaka", familyName: "Nwosu", dateOfBirth: "1992-02-14", sex: "FEMALE" as const };
const checklist = ["SIGN_IN", "SIGN_IN", "TIME_OUT", "SIGN_OUT"].map((phase, position) => ({
  id: `c${position}`, phase: phase as "SIGN_IN", position, label: `Check ${position}`, completed: false, exceptionReason: null,
}));
const procedure = (extra: Partial<ApiProcedure> = {}): ApiProcedure => ({
  id: "pr1", patientId: "p1", encounterId: "e1", name: "Incision and drainage", code: "INCISION_AND_DRAINAGE", indication: "Thigh abscess",
  bodySite: "Left thigh", laterality: "LEFT", priority: "URGENT", status: "REQUESTED", version: 1, createdAt: "2026-10-10T09:00:00.000Z",
  requestedByName: "Tunde Bakare", scheduledFor: null, performerUserId: null, performerName: null, assistants: [],
  consentObtainedByUserId: null, consentObtainedByName: null, consentAt: null, performedAt: null, anaesthesia: null, device: null,
  complications: null, outcome: null, findings: null, specimenSentToLab: false, recoveryNotes: null, followUpPlan: null,
  noteSignedByName: null, noteSignedAt: null, cancellationReason: null, checklist, amendments: [], patient, ...extra,
});

let rows: ApiProcedure[] = [];
beforeEach(() => {
  rows = [procedure()];
  api.emrRequest.mockReset();
  api.emrRequest.mockImplementation(async (path: string) => {
    if (path.startsWith("/procedures?")) return { data: { items: rows } };
    if (path.startsWith("/staff")) return { data: { items: [{ userId: "u2", name: "Tunde Bakare" }, { userId: "u3", name: "Grace Nwangbo" }] } };
    if (path.startsWith("/patients?")) return { data: { items: [patient] } };
    if (path.endsWith("/perform")) throw Object.assign(new Error("Complete the safety checklist first (tick each item or give a reason): Check 3."), { code: "VALIDATION_FAILED" });
    return { data: {} };
  });
  useLiveProcedures.setState({ procedures: [], clinicians: [], loaded: false, error: "" });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u2", name: "Tunde Bakare", email: "doctor@hospital.test", role: "Doctor" },
    access: { organizationId: ORG, facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["DOCTOR"], permissions: ["procedure.read", "procedure.order.create", "procedure.perform", "patient.read"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

const openFirst = async () => {
  fireEvent.click(await screen.findByText("Incision and drainage"));
  return screen.findByRole("dialog");
};

describe("live procedure data", () => {
  it("maps a procedure, its team, checklist and note onto the screen's shapes", () => {
    const mapped = procedureFromApi(procedure({
      status: "PRE_PROCEDURE", version: 4, performerUserId: "u2", performerName: "Tunde Bakare", assistants: [{ userId: "u3", name: "Grace Nwangbo" }],
      noteSignedAt: "2026-10-10T11:00:00.000Z", noteSignedByName: "Tunde Bakare", amendments: [{ note: "Volume 20 mL", authorName: "Tunde Bakare", createdAt: "2026-10-10T12:00:00.000Z" }],
    }));
    expect(mapped).toMatchObject({ status: "Pre-procedure", laterality: "Left", priority: "Urgent", performer: "Tunde Bakare", assistants: ["Grace Nwangbo"], assistantUserIds: ["u3"], noteSigned: true, version: 4 });
    expect(mapped.checklist.map((i) => i.phase)).toEqual(["Sign In", "Sign In", "Time Out", "Sign Out"]);
    expect(mapped.amendments).toEqual([{ by: "Tunde Bakare", at: "2026-10-10T12:00:00.000Z", note: "Volume 20 mL" }]);
    expect(liveRouteState("/procedures", ["procedure.read"])).toBe("connected");
  });
});

describe("the live Procedures screen", () => {
  it("schedules with the hospital's clinicians and records consent", async () => {
    render(<MemoryRouter><Procedures /></MemoryRouter>);
    const dialog = await openFirst();
    fireEvent.change(dialog.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: "2026-10-12" } });
    fireEvent.click(await within(dialog).findByRole("button", { name: "Grace Nwangbo" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Schedule" }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/procedures/pr1/schedule", { method: "POST", version: 1, body: { scheduledFor: "2026-10-12", performerUserId: "u2", assistantUserIds: ["u3"] } }));

    rows = [procedure({ status: "SCHEDULED", version: 2, scheduledFor: "2026-10-12", performerUserId: "u2", performerName: "Tunde Bakare" })];
    await useLiveProcedures.getState().load();
    fireEvent.change(await within(dialog).findByRole("combobox"), { target: { value: "u3" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Record consent/ }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/procedures/pr1/consent", { method: "POST", version: 2, body: { obtainedByUserId: "u3" } }));
  });

  it("saves checklist ticks and reasons, and shows why the hospital refuses to record it as performed", async () => {
    rows = [procedure({ status: "PRE_PROCEDURE", version: 4, consentObtainedByName: "Grace Nwangbo", consentAt: "2026-10-10T10:00:00.000Z" })];
    render(<MemoryRouter><Procedures /></MemoryRouter>);
    const dialog = await openFirst();
    fireEvent.click(within(dialog).getByLabelText("Check 0"));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/procedures/pr1/checklist/c0", { method: "PUT", body: { completed: true } }));
    const reason = within(dialog).getAllByPlaceholderText("Exception reason")[1];
    fireEvent.change(reason, { target: { value: "Not applicable" } });
    expect(api.emrRequest).not.toHaveBeenCalledWith("/procedures/pr1/checklist/c1", expect.anything());
    fireEvent.blur(reason);
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/procedures/pr1/checklist/c1", { method: "PUT", body: { completed: false, exceptionReason: "Not applicable" } }));

    const outcome = within(dialog).getAllByRole("textbox").filter((t) => t.tagName === "TEXTAREA")[1];
    fireEvent.change(outcome, { target: { value: "Drained 15 mL" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark performed" }));
    expect(await within(dialog).findByText(/Complete the safety checklist first/)).toBeTruthy();
  });

  it("requests a procedure once per request", async () => {
    rows = [];
    render(<MemoryRouter><Procedures /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Request procedure/ }));
    const dialog = await screen.findByRole("dialog");
    const search = within(dialog).getByPlaceholderText("Search by name, MRN, phone…");
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "Amaka" } });
    fireEvent.mouseDown(await within(dialog).findByRole("button", { name: /Amaka Nwosu/ }));
    fireEvent.change(dialog.querySelector("textarea") as HTMLTextAreaElement, { target: { value: "Laceration of the forearm" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Request" }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/procedures", expect.objectContaining({
      method: "POST", idempotencyKey: expect.any(String),
      body: { patientId: "p1", name: "Incision and drainage", indication: "Laceration of the forearm", priority: "ROUTINE" },
    })));
  });
});

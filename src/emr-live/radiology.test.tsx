import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ emrRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("./client")>()), emrRequest: api.emrRequest }));

import Radiology from "@/pages/diagnostics/Radiology";
import { studyFromApi, useLiveRadiology, type ApiStudy } from "./radiology";
import { liveRouteState } from "./routes";
import { useLiveEmr } from "./session";

const ORG = "11111111-1111-4111-8111-111111111111";
const patient = { id: "p1", medicalRecordNumber: "MRN-0000001", givenName: "Amaka", familyName: "Nwosu", dateOfBirth: "1992-02-14", sex: "FEMALE" as const };
const study = (extra: Partial<ApiStudy> = {}): ApiStudy => ({
  id: "s1", patientId: "p1", encounterId: "e1", accessionNumber: "RAD-2026-000001", modality: "XRAY", bodySite: "Chest", laterality: null,
  indication: "Chronic cough", priority: "URGENT", preparation: null, externalStudy: false, status: "REQUESTED", version: 1,
  createdAt: "2026-10-10T09:00:00.000Z", requestedByName: "Tunde Bakare", scheduledFor: null, performedAt: null, cancellationReason: null,
  compareToStudyId: null, series: [], report: null, addenda: [], patient, ...extra,
});
const verified = study({
  id: "s0", accessionNumber: "RAD-2026-000000", status: "AMENDED", version: 6, performedAt: "2026-09-01T10:00:00.000Z",
  series: [{ id: "x1", seriesNumber: 1, description: "PA chest", bodyPart: "Chest", imageCount: 1 }],
  report: { findings: "Lung fields clear.", impression: "Normal chest.", authorName: "Kola Ade", authoredAt: "2026-09-01T11:00:00.000Z", verifiedByName: "Kola Ade", verifiedAt: "2026-09-01T12:00:00.000Z" },
  addenda: [{ note: "Compared with 2025 film: unchanged.", authorName: "Kola Ade", createdAt: "2026-09-02T09:00:00.000Z" }],
});

let rows: ApiStudy[] = [];
beforeEach(() => {
  rows = [study(), verified];
  api.emrRequest.mockReset();
  api.emrRequest.mockImplementation(async (path: string) => {
    if (path.startsWith("/imaging/studies?")) return { data: { items: rows } };
    if (path.startsWith("/patients?")) return { data: { items: [patient] } };
    if (path.endsWith("/cancel")) throw Object.assign(new Error("A performed study cannot be cancelled; record what happened in its report or an addendum instead."), { code: "INVALID_STATE" });
    return { data: {} };
  });
  useLiveRadiology.setState({ studies: [], loaded: false, error: "" });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u1", name: "Kola Ade", email: "radiology@hospital.test", role: "Radiologist" },
    access: { organizationId: ORG, facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["RADIOLOGIST"], permissions: ["imaging.read", "imaging.perform", "imaging.report", "patient.read"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("live imaging data", () => {
  it("maps a study, its series, report and addenda onto the screen's shapes", () => {
    const mapped = studyFromApi(verified);
    expect(mapped).toMatchObject({ modality: "X-ray", priority: "Urgent", status: "Amended", laterality: "N/A", requestedBy: "Tunde Bakare", version: 6, patient: { firstName: "Amaka" } });
    expect(mapped.series[0]).toMatchObject({ seriesNumber: 1, description: "PA chest", imageCount: 1 });
    expect(mapped.report).toMatchObject({ author: "Kola Ade", verifiedBy: "Kola Ade", addenda: [{ by: "Kola Ade", note: "Compared with 2025 film: unchanged." }] });
    expect(studyFromApi(study({ laterality: "LEFT", modality: "ULTRASOUND" }))).toMatchObject({ laterality: "Left", modality: "Ultrasound" });
    expect(liveRouteState("/radiology", ["imaging.read"])).toBe("connected");
    expect(liveRouteState("/radiology", ["billing.read"])).toBe("no-permission");
  });
});

describe("the live Radiology screen", () => {
  it("works through the hospital's studies: perform with series, then report", async () => {
    render(<MemoryRouter><Radiology /></MemoryRouter>);
    expect(await screen.findByText("RAD-2026-000001")).toBeTruthy();
    fireEvent.click(screen.getByText("RAD-2026-000001"));
    const dialog = await screen.findByRole("dialog");
    const description = within(dialog).getAllByRole("textbox").find((input) => (input as HTMLInputElement).value === "") as HTMLInputElement;
    fireEvent.change(description, { target: { value: "PA chest" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark performed" }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/imaging/studies/s1/perform", { method: "POST", version: 1, body: { series: [{ description: "PA chest", bodyPart: "Chest", imageCount: 1 }] } }));

    rows = [study({ status: "PERFORMED", version: 2, performedAt: "2026-10-10T10:00:00.000Z", series: [{ id: "x2", seriesNumber: 1, description: "PA chest", bodyPart: "Chest", imageCount: 1 }] }), verified];
    await useLiveRadiology.getState().load();
    const textareas = await within(dialog).findAllByRole("textbox");
    fireEvent.change(textareas.find((t) => t.tagName === "TEXTAREA" && (t as HTMLTextAreaElement).value === "") as HTMLTextAreaElement, { target: { value: "Lung fields clear." } });
    fireEvent.change(within(dialog).getAllByRole("textbox").filter((t) => t.tagName === "TEXTAREA")[1], { target: { value: "No acute abnormality." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save report" }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/imaging/studies/s1/report", { method: "POST", version: 2, body: { findings: "Lung fields clear.", impression: "No acute abnormality." } }));
  });

  it("shows the hospital's reason when it refuses a step", async () => {
    rows = [study({ status: "PERFORMED", version: 2, performedAt: "2026-10-10T10:00:00.000Z" })];
    render(<MemoryRouter><Radiology /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("tab", { name: "Reporting" }));
    fireEvent.click(await screen.findByText("RAD-2026-000001"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel this study" }));
    fireEvent.change(within(dialog).getByLabelText("Reason for cancelling"), { target: { value: "Wrong patient" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm cancel" }));
    expect(await within(dialog).findByText(/A performed study cannot be cancelled/)).toBeTruthy();
  });

  it("requests imaging once per request with the hospital's codes", async () => {
    rows = [];
    render(<MemoryRouter><Radiology /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Request imaging/ }));
    const dialog = await screen.findByRole("dialog");
    const search = within(dialog).getByPlaceholderText("Search by name, MRN, phone…");
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "Amaka" } });
    fireEvent.mouseDown(await within(dialog).findByRole("button", { name: /Amaka Nwosu/ }));
    const [modality, priority, laterality] = within(dialog).getAllByRole("combobox");
    fireEvent.change(modality, { target: { value: "Ultrasound" } });
    fireEvent.change(priority, { target: { value: "Urgent" } });
    fireEvent.change(laterality, { target: { value: "Left" } });
    fireEvent.change(within(dialog).getByPlaceholderText("e.g. Chest, Left ankle"), { target: { value: "Breast" } });
    fireEvent.change(dialog.querySelector("textarea") as HTMLTextAreaElement, { target: { value: "Palpable lump" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Request" }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/imaging/studies", expect.objectContaining({
      method: "POST", idempotencyKey: expect.any(String),
      body: { patientId: "p1", modality: "ULTRASOUND", bodySite: "Breast", indication: "Palpable lump", priority: "URGENT", externalStudy: false, laterality: "LEFT" },
    })));
  });
});

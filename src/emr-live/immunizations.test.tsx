import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ emrRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("./client")>()), emrRequest: api.emrRequest }));

import Immunization from "@/pages/mch/Immunization";
import Surveillance from "@/pages/programs/Surveillance";
import { useLiveImmunization } from "./immunizations";
import { useLiveSurveillance, type ApiCase } from "./surveillance";
import { liveRouteState } from "./routes";
import { useLiveEmr } from "./session";

const weeksAgo = (n: number) => new Date(Date.now() - n * 7 * 86_400_000).toISOString().slice(0, 10);
const baby = { id: "c1", medicalRecordNumber: "MRN-0000009", givenName: "Tobi", familyName: "Adewale", dateOfBirth: weeksAgo(7), sex: "MALE" as const };
const suspected: ApiCase = { id: "s1", patientId: "c1", patient: baby, version: 1, diseaseCode: "MEAS", diseaseName: "Measles", immediate: true, onsetDate: weeksAgo(0), notes: "Rash and fever", source: "MANUAL", status: "SUSPECTED", reportedAt: new Date().toISOString(), reportedByName: "Grace Nwangbo", classifiedByName: null, classificationNote: null };

beforeEach(() => {
  api.emrRequest.mockReset();
  api.emrRequest.mockImplementation(async (path: string) => {
    if (path === "/immunizations/defaulters") return { data: { items: [{ patientId: "c1", patient: baby, ageWeeks: 15, missed: [{ vaccineCode: "PENTA2", vaccineName: "Pentavalent Vaccine (Dose 2)", dueAgeWeeks: 10, weeksLate: 5 }] }] } };
    if (path === "/immunizations?aefi=true") return { data: { items: [] } };
    if (path.startsWith("/immunizations?patientId")) return { data: { items: [{ id: "d1", patientId: "c1", vaccineCode: "BCG", vaccineName: "BCG", givenAt: weeksAgo(6), batchNumber: "B-1", site: "Left deltoid", givenByName: "Grace Nwangbo", status: "ACTIVE", aefi: null }] } };
    if (path.startsWith("/patients")) return { data: { items: [baby] } };
    if (path.startsWith("/surveillance?")) return { data: { items: [suspected], diseases: [{ code: "MEAS", name: "Measles", class: "IDSR Immediate", immediate: true }] } };
    return { data: {} };
  });
  useLiveImmunization.setState({ childDoses: [], childId: null, defaulters: [], aefi: [], error: "" });
  useLiveSurveillance.setState({ cases: [], diseases: [], error: "" });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u2", name: "Tunde Bakare", email: "doctor@hospital.test", role: "Doctor" },
    access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["DOCTOR"], permissions: ["immunization.read", "immunization.give", "surveillance.read", "surveillance.notify", "surveillance.classify", "patient.read"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("live immunization and surveillance", () => {
  it("are connected screens for staff who may read them", () => {
    expect(liveRouteState("/immunization", ["immunization.read"])).toBe("connected");
    expect(liveRouteState("/surveillance", ["surveillance.read"])).toBe("connected");
  });

  it("shows the hospital's defaulters and gives a dose to the picked child", async () => {
    render(<MemoryRouter><Immunization /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("tab", { name: "Defaulters (1)" }));
    expect(await screen.findByText("Pentavalent Vaccine (Dose 2)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Give Vaccine" }));
    const search = screen.getByPlaceholderText("Search child…");
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "Tobi" } });
    fireEvent.mouseDown(await screen.findByRole("button", { name: /Tobi Adewale/ }));
    expect(await screen.findByText(/1 doses on file/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Give" })[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Batch / lot number"), { target: { value: "OPV-0042" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Record dose" }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/immunizations", expect.objectContaining({
      method: "POST", idempotencyKey: expect.any(String), body: expect.objectContaining({ patientId: "c1", batchNumber: "OPV-0042" }),
    })));
  });

  it("lets a doctor discard a suspected case only with a reason", async () => {
    render(<MemoryRouter><Surveillance /></MemoryRouter>);
    expect(await screen.findByText("Measles", { selector: "td" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    const dialog = await screen.findByRole("dialog");
    const save = within(dialog).getByRole("button", { name: "Discard case" });
    expect(save).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Why it is discarded"), { target: { value: "Rash was a drug reaction" } });
    fireEvent.click(save);
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/surveillance/s1/classify", { method: "POST", version: 1, body: { status: "DISCARDED", note: "Rash was a drug reaction" } }));
  });
});

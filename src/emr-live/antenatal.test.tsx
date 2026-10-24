import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ emrRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("./client")>()), emrRequest: api.emrRequest }));

import Antenatal from "@/pages/mch/Antenatal";
import { ancFromApi, parseBloodPressure, useLiveAntenatal, type ApiPregnancy } from "./antenatal";
import { liveRouteState } from "./routes";
import { useLiveEmr } from "./session";

const ORG = "11111111-1111-4111-8111-111111111111";
const patient = { id: "p1", medicalRecordNumber: "MRN-0000001", givenName: "Amaka", familyName: "Nwosu", dateOfBirth: "1992-02-14", sex: "FEMALE" as const };
const pregnancy = (extra: Partial<ApiPregnancy> = {}): ApiPregnancy => ({
  id: "pg1", patientId: "p1", version: 1, status: "ACTIVE", lmp: "2026-06-01", edd: "2027-03-08", gravida: 2, parity: 1,
  bloodGroup: "O+", bookingHb: 11.5, ttDoses: 1, gestationalWeeksToday: 19, riskFlags: [], patient,
  visits: [
    { id: "v1", visitDate: "2026-09-01", gestationalWeeks: 13, weightKg: 62.5, systolic: 118, diastolic: 76, hb: 9.2, fetalHeartRate: 148, nextVisitDate: "2026-09-29", notes: null, status: "ACTIVE", recordedByName: "Grace Nwangbo" },
    { id: "v0", visitDate: "2026-08-30", gestationalWeeks: 12, weightKg: 70, systolic: null, diastolic: null, hb: null, fetalHeartRate: null, nextVisitDate: null, notes: null, status: "ENTERED_IN_ERROR", recordedByName: "Grace Nwangbo" },
  ],
  labs: [{ orderId: "o1", itemId: "i1", testName: "Full blood count", status: "VERIFIED", orderedAt: "2026-09-01T09:00:00.000Z", result: "Haemoglobin: 9.2 g/dL" }],
  ...extra,
});

let rows: ApiPregnancy[] = [];
beforeEach(() => {
  rows = [pregnancy({ riskFlags: [{ code: "ANAEMIA", label: "Anaemia (Hb 9.2 g/dL)" }] })];
  api.emrRequest.mockReset();
  api.emrRequest.mockImplementation(async (path: string) => {
    if (path.startsWith("/antenatal?")) return { data: { items: rows } };
    if (path.startsWith("/patients")) return { data: { items: [patient] } };
    return { data: {} };
  });
  useLiveAntenatal.setState({ records: [], loaded: false, error: "" });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u3", name: "Grace Nwangbo", email: "nurse@hospital.test", role: "Nurse" },
    access: { organizationId: ORG, facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["NURSE"], permissions: ["anc.read", "anc.manage", "patient.read"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("live antenatal care", () => {
  it("is a connected screen for staff who may read antenatal records", () => {
    expect(liveRouteState("/anc", ["anc.read"])).toBe("connected");
    expect(liveRouteState("/anc", ["patient.read"])).toBe("no-permission");
  });

  it("maps the hospital's record: latest Hb, BP text, entered-in-error visits left out, labs kept", () => {
    const record = ancFromApi(rows[0]);
    expect(record).toMatchObject({ para: 1, hb: 9.2, status: "Active", gestationalWeeksToday: 19, riskFlags: [{ code: "ANAEMIA" }] });
    expect(record.visits).toEqual([expect.objectContaining({ id: "v1", weeks: 13, weight: 62.5, bp: "118/76", next: "2026-09-29", recordedBy: "Grace Nwangbo" })]);
    expect(record.labs).toEqual([expect.objectContaining({ testName: "Full blood count", status: "Verified", result: "Haemoglobin: 9.2 g/dL" })]);
    expect(ancFromApi(pregnancy({ status: "TRANSFERRED_OUT", labs: null })).labs).toBeNull();
    expect(parseBloodPressure(" 120 / 80 ")).toEqual({ systolic: 120, diastolic: 80 });
    expect(parseBloodPressure("")).toEqual({});
    expect(() => parseBloodPressure("120")).toThrow(/systolic\/diastolic/);
  });

  it("shows live enrolments with risk, and records a visit with the server working out gestational age", async () => {
    render(<MemoryRouter><Antenatal /></MemoryRouter>);
    expect(await screen.findByText("Amaka Nwosu")).toBeInTheDocument();
    expect(screen.getByText("19 weeks today")).toBeInTheDocument();
    expect(screen.getByText("High risk").closest("[title]")).toHaveAttribute("title", "Anaemia (Hb 9.2 g/dL)");

    fireEvent.click(screen.getByRole("button", { name: /Record Visit/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getAllByRole("combobox")[0], { target: { value: "pg1" } });
    fireEvent.change(within(dialog).getByLabelText("Visit date"), { target: { value: "2026-10-13" } });
    expect(within(dialog).getByLabelText("Gestational age (weeks)")).toHaveValue("19 (from LMP)");
    fireEvent.change(within(dialog).getByLabelText("Blood pressure"), { target: { value: "150/95" } });
    fireEvent.change(within(dialog).getByLabelText("Weight (kg)"), { target: { value: "64" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Visit" }));

    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/antenatal/pg1/visits", expect.objectContaining({
      method: "POST", idempotencyKey: expect.any(String), body: { visitDate: "2026-10-13", systolic: 150, diastolic: 95, weightKg: 64 },
    })));
  });

  it("keeps the form open and explains a typing mistake in the blood pressure", async () => {
    render(<MemoryRouter><Antenatal /></MemoryRouter>);
    await screen.findByText("Amaka Nwosu");
    fireEvent.click(screen.getByRole("button", { name: /Record Visit/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getAllByRole("combobox")[0], { target: { value: "pg1" } });
    fireEvent.change(within(dialog).getByLabelText("Visit date"), { target: { value: "2026-10-13" } });
    fireEvent.change(within(dialog).getByLabelText("Blood pressure"), { target: { value: "high" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Visit" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("for example 120/80");
    expect(api.emrRequest).not.toHaveBeenCalledWith("/antenatal/pg1/visits", expect.anything());
  });
});

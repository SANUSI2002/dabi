import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ emrRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("./client")>()), emrRequest: api.emrRequest }));

import Ncd from "@/pages/programs/Ncd";
import Malaria from "@/pages/programs/Malaria";
import { ncdFromApi, parseBp, useLiveProgrammes, type ApiMalaria, type ApiNcdClient } from "./programmes";
import { liveRouteState } from "./routes";
import { useLiveEmr } from "./session";

const person = { id: "p1", medicalRecordNumber: "MRN-0000021", givenName: "Bola", familyName: "Ade", dateOfBirth: "1970-02-01", sex: "MALE" as const };
const client: ApiNcdClient = { id: "n1", patientId: "p1", patient: person, condition: "Essential hypertension", systolic: 162, diastolic: 101, fastingGlucoseMmol: null, control: "UNCONTROLLED", nextVisitDate: "2099-01-01", enrolledAt: "2026-10-01T09:00:00.000Z", enrolledByName: "Grace Nwangbo" };
const malaria: ApiMalaria = {
  since: "2025-10-19", suspected: 7, tested: 5, positive: 3, confirmed: 3, treatedWithAct: 2,
  cases: [{ encounterId: "e1", patientId: "p1", patient: person, diagnosedAt: "2026-10-15T10:00:00.000Z", diagnoses: ["Malaria, uncomplicated"], treatment: ["Artemether/lumefantrine"] }],
  weeklyTrend: [{ weekStart: "2026-10-05", tested: 2, positive: 1 }, { weekStart: "2026-10-12", tested: 3, positive: 2 }],
};

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
  api.emrRequest.mockReset();
  api.emrRequest.mockImplementation(async (path: string) => (path.startsWith("/programmes/ncd?") ? { data: { items: [client] } } : path === "/programmes/malaria" ? { data: malaria } : { data: {} }));
  useLiveProgrammes.setState({ ncd: [], malaria: null, error: "" });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u3", name: "Grace Nwangbo", email: "nurse@hospital.test", role: "Nurse" },
    access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["NURSE"], permissions: ["programme.read", "ncd.enrol", "patient.read"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("live NCD register and malaria indicators", () => {
  it("are connected, and map readings and blood pressure", () => {
    expect(liveRouteState("/ncd", ["programme.read"])).toBe("connected");
    expect(liveRouteState("/malaria", ["programme.read"])).toBe("connected");
    expect(ncdFromApi(client)).toMatchObject({ bp: "162/101", control: "Uncontrolled", nextVisit: "2099-01-01" });
    expect(parseBp(" 140 / 90 ")).toEqual({ systolic: 140, diastolic: 90 });
    expect(parseBp("")).toEqual({});
    expect(() => parseBp("high")).toThrow(/systolic\/diastolic/);
  });

  it("shows the live register", async () => {
    render(<MemoryRouter><Ncd /></MemoryRouter>);
    expect(await screen.findByText("Bola Ade")).toBeInTheDocument();
    expect(screen.getByText("162/101")).toBeInTheDocument();
  });

  it("refuses a malformed blood pressure before sending anything", async () => {
    useLiveProgrammes.setState({ ncd: [] });
    await expect(useLiveProgrammes.getState().enrol({ patientId: "p1", condition: "Asthma", bp: "abc", fbs: 0, nextVisit: "", control: "Controlled" }, "k1")).rejects.toThrow();
    expect(api.emrRequest).not.toHaveBeenCalledWith("/programmes/ncd", expect.anything());
    await useLiveProgrammes.getState().enrol({ patientId: "p1", condition: "Asthma", bp: "130/85", fbs: 6.44, nextVisit: "2026-11-01", control: "Controlled" }, "k2");
    expect(api.emrRequest).toHaveBeenCalledWith("/programmes/ncd", { method: "POST", idempotencyKey: "k2", body: { patientId: "p1", condition: "Asthma", systolic: 130, diastolic: 85, fastingGlucoseMmol: 6.4, control: "CONTROLLED", nextVisitDate: "2026-11-01" } });
  });

  it("shows the hospital's malaria indicators and confirmed cases", async () => {
    render(<MemoryRouter><Malaria /></MemoryRouter>);
    expect(await screen.findByText("Bola Ade")).toBeInTheDocument();
    expect(screen.getByText("Artemether/lumefantrine")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Weekly Trend" }));
    await waitFor(() => expect(screen.queryByText(/Not enough weekly testing history/)).not.toBeInTheDocument());
  });
});

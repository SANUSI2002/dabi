import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ emrRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("./client")>()), emrRequest: api.emrRequest }));

import Nutrition from "@/pages/mch/Nutrition";
import { growthFromApi, screeningFromApi, useLiveNutrition, type ApiScreening } from "./nutrition";
import { liveRouteState } from "./routes";
import { useLiveEmr } from "./session";

const kid = { id: "k1", medicalRecordNumber: "MRN-0000011", givenName: "Ada", familyName: "Eze", dateOfBirth: "2024-09-01", sex: "FEMALE" as const };
const open: ApiScreening = { id: "s1", patientId: "k1", patient: kid, version: 1, screeningDate: "2026-10-10", muacCm: 11.2, oedema: "NONE", appetite: "FAIL", growthMonitoringDone: true, notes: null, classification: "SAM", programme: "SC", source: "CHILD_HEALTH", outcome: null, dischargedAt: null };

beforeEach(() => {
  api.emrRequest.mockReset();
  api.emrRequest.mockImplementation(async (path: string) => (path.startsWith("/nutrition/cmam?") ? { data: { items: [open] } } : path.startsWith("/nutrition/growth?") ? { data: { items: [] } } : { data: {} }));
  useLiveNutrition.setState({ visits: [], screenings: [], error: "" });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u3", name: "Grace Nwangbo", email: "nurse@hospital.test", role: "Nurse" },
    access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["NURSE"], permissions: ["nutrition.read", "nutrition.record", "patient.read"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("live child health and nutrition", () => {
  it("are connected, and map the hospital's classification and programme", () => {
    expect(liveRouteState("/child-health", ["nutrition.read"])).toBe("connected");
    expect(liveRouteState("/nutrition", ["nutrition.read"])).toBe("connected");
    expect(screeningFromApi(open)).toMatchObject({ cls: "SAM", program: "SC", appetite: "Fail", source: "Child Health", oedema: "None" });
    expect(growthFromApi({ id: "g1", patientId: "k1", visitDate: "2026-10-10", weightKg: 9, heightCm: 80, muacCm: 13, waz: null, feeding: "FAMILY_DIET", classification: "NORMAL", status: "ACTIVE", enrolledInCmam: false })).toMatchObject({ status: "Normal", feeding: "Family diet" });
  });

  it("discharges a child from the live caseload with a Sphere outcome", async () => {
    render(<MemoryRouter><Nutrition /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("tab", { name: "Active Caseload" }));
    expect(await screen.findByText("Ada Eze")).toBeInTheDocument();
    expect(screen.getByText("SC")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Discharge/ }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cured" }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/nutrition/cmam/s1/discharge", { method: "POST", version: 1, body: { outcome: "CURED" } }));
  });
});

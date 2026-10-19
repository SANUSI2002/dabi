import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ emrRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("./client")>()), emrRequest: api.emrRequest }));

import Postnatal from "@/pages/mch/Postnatal";
import { toCode, toLabel, useLivePostnatal, visitFromApi, type ApiDue, type ApiPncVisit } from "./postnatal";
import { liveRouteState } from "./routes";
import { useLiveEmr } from "./session";

const mother = { id: "p1", medicalRecordNumber: "MRN-0000001", givenName: "Ngozi", familyName: "Okafor", dateOfBirth: "1996-03-10", sex: "FEMALE" as const };
const due: ApiDue = { deliveryId: "d1", patientId: "p1", patient: mother, deliveredAt: "2026-10-14T03:00:00.000Z", deliveryMode: "SVD", babyStatus: "ALIVE", daysPostpartum: 5, nextContact: 1, overdueDays: 4, status: "OVERDUE" };
const visit: ApiPncVisit = { id: "v1", patientId: "p1", patient: mother, deliveryId: "d1", visitDate: "2026-10-17", daysPostpartum: 3, contact: 2, systolic: 118, diastolic: 76, uterus: "WELL_CONTRACTED", lochia: "NORMAL", breast: "CRACKED_NIPPLE", breastfeeding: "NOT_BREASTFEEDING", dangerSigns: [], fpCounselled: true, notes: null, escalatedEncounterId: null, status: "ACTIVE", recordedByName: "Grace Nwangbo" };

beforeEach(() => {
  api.emrRequest.mockReset();
  api.emrRequest.mockImplementation(async (path: string) => {
    if (path.startsWith("/postnatal?")) return { data: { items: [visit, { ...visit, id: "v0", status: "ENTERED_IN_ERROR" }] } };
    if (path === "/postnatal/due") return { data: { items: [due] } };
    if (path.startsWith("/deliveries?")) return { data: { items: [{ id: "d1", deliveredAt: due.deliveredAt, mode: "SVD", babyStatus: "ALIVE", status: "ACTIVE" }] } };
    if (path === "/postnatal") return { data: { ...visit, id: "v2", dangerSigns: ["Jaundice"], escalatedEncounterId: "e1" } };
    return { data: { items: [] } };
  });
  useLivePostnatal.setState({ visits: [], due: [], deliveriesFor: {}, error: "" });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u3", name: "Grace Nwangbo", email: "nurse@hospital.test", role: "Nurse" },
    access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["NURSE"], permissions: ["pnc.read", "pnc.record", "patient.read"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("live postnatal care", () => {
  it("is connected for staff who may read postnatal records, and maps codes to labels", () => {
    expect(liveRouteState("/pnc", ["pnc.read"])).toBe("connected");
    expect(toCode("Not breastfeeding")).toBe("NOT_BREASTFEEDING");
    expect(toLabel("CRACKED_NIPPLE")).toBe("Cracked nipple");
    expect(visitFromApi(visit)).toMatchObject({ contact: 2, daysPP: 3, bp: "118/76", breast: "Cracked nipple", breastfeeding: "Not breastfeeding", recordedBy: "Grace Nwangbo" });
  });

  it("shows the hospital's due list and records a contact with danger signs", async () => {
    render(<MemoryRouter><Postnatal /></MemoryRouter>);
    expect(await screen.findByText("Ngozi Okafor")).toBeInTheDocument();
    expect(screen.getByText(/Overdue · 4d/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Record contact" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Jaundice" }));
    fireEvent.click(screen.getByRole("button", { name: "Save visit" }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/postnatal", expect.objectContaining({
      method: "POST", idempotencyKey: expect.any(String),
      body: expect.objectContaining({ patientId: "p1", deliveryId: "d1", uterus: "WELL_CONTRACTED", breastfeeding: "EXCLUSIVE", dangerSigns: ["Jaundice"] }),
    })));
    expect(await screen.findByText(/sent her to the Consultation queue as Urgent/)).toBeInTheDocument();
  });
});

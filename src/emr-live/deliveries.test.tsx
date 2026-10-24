import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ emrRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("./client")>()), emrRequest: api.emrRequest }));

import Labour from "@/pages/mch/Labour";
import { deliveryBody, deliveryFromApi, useLiveDeliveries, type ApiDelivery, type ApiRegisterEntry } from "./deliveries";
import { liveRouteState } from "./routes";
import { useLiveEmr } from "./session";

const ORG = "11111111-1111-4111-8111-111111111111";
const mother = { id: "p1", medicalRecordNumber: "MRN-0000001", givenName: "Ngozi", familyName: "Okafor", dateOfBirth: "1996-03-10", sex: "FEMALE" as const };
const delivery = (extra: Partial<ApiDelivery> = {}): ApiDelivery => ({
  id: "d1", patientId: "p1", pregnancyId: "pg1", status: "ACTIVE", patient: mother, bookingStatus: "BOOKED", deliveredAt: "2026-10-18T03:20:00.000Z",
  gestationalWeeks: 39, mode: "ASSISTED_VACUUM", motherStatus: "ALIVE", bloodLossMl: 350, complications: null, notes: null,
  nhmisIndicators: ["Labour monitored with partograph"], babySex: "FEMALE", babyStatus: "ALIVE", birthWeightKg: 3.15, apgar1: 7, apgar5: 9,
  breastfedWithinHour: true, conductedByName: "Grace Nwangbo", registration: null, ...extra,
});
const entry = (extra: Partial<ApiRegisterEntry> = {}): ApiRegisterEntry => ({
  id: "r1", deliveryId: "d1", patientId: "p1", version: 1, status: "NOTIFIED", babyName: null, fatherName: "Emeka Okafor", informantName: "Ngozi Okafor",
  informantRelation: "MOTHER", notificationNumber: "BN-2026-000001", registrationNumber: null, notifiedAt: "2026-10-18T09:00:00.000Z",
  registeredAt: null, certificateIssuedAt: null, notifiedByName: "Grace Nwangbo", registeredByName: null, certificateIssuedByName: null,
  patient: mother, bornAt: "2026-10-18T03:20:00.000Z", babySex: "FEMALE", birthWeightKg: 3.15, deliveryMode: "ASSISTED_VACUUM", ...extra,
});

let deliveries: ApiDelivery[] = [];
let register: ApiRegisterEntry[] = [];
beforeEach(() => {
  deliveries = [delivery(), delivery({ id: "d0", status: "ENTERED_IN_ERROR" })];
  register = [entry()];
  api.emrRequest.mockReset();
  api.emrRequest.mockImplementation(async (path: string) => {
    if (path.startsWith("/deliveries?")) return { data: { items: deliveries } };
    if (path.startsWith("/births?")) return { data: { items: register } };
    if (path.startsWith("/staff")) return { data: { items: [{ userId: "u3", name: "Grace Nwangbo" }, { userId: "u2", name: "Tunde Bakare" }] } };
    if (path.startsWith("/patients")) return { data: { items: [mother] } };
    return { data: {} };
  });
  useLiveDeliveries.setState({ deliveries: [], register: [], clinicians: [], loaded: false, error: "" });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u3", name: "Grace Nwangbo", email: "nurse@hospital.test", role: "Nurse" },
    access: { organizationId: ORG, facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["NURSE"], permissions: ["delivery.read", "delivery.record", "birth.register", "patient.read"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("live labour & delivery", () => {
  it("is a connected screen for staff who may read deliveries", () => {
    expect(liveRouteState("/labour", ["delivery.read"])).toBe("connected");
    expect(liveRouteState("/labour", ["anc.read"])).toBe("no-permission");
  });

  it("maps the hospital's codes to the screen's labels and back", () => {
    const d = deliveryFromApi(delivery({ babyStatus: "FRESH_STILLBIRTH", apgar1: null, apgar5: null }), "Sabi Test General Hospital");
    expect(d).toMatchObject({ mode: "Assisted (vacuum)", bookingStatus: "Booked", babyStatus: "Fresh stillbirth", babySex: "F", weight: 3.15, linkedToAntenatal: true, conductedBy: "Grace Nwangbo" });
    const body = deliveryBody({ patientId: "p1", date: "2026-10-18T04:20", mode: "Breech", gaWeeks: 37, bookingStatus: "Referred in", complications: " ", notes: "", nhmisIndicators: [],
      motherStatus: "Alive", bloodLoss: 400, babySex: "M", babyStatus: "Macerated stillbirth", weight: 2.4, apgar1: 8, apgar5: 9, breastfed1h: true, conductedBy: "u3" });
    expect(body).toMatchObject({ mode: "BREECH", bookingStatus: "REFERRED_IN", babySex: "MALE", babyStatus: "MACERATED_STILLBIRTH", breastfedWithinHour: false, conductedByUserId: "u3", gestationalWeeks: 37 });
    expect(body).not.toHaveProperty("apgar1");
    expect(body).not.toHaveProperty("complications");
  });

  it("shows live deliveries (not those entered in error) and the register with who notified", async () => {
    render(<MemoryRouter><Labour /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("tab", { name: "Delivery Records" }));
    expect(await screen.findByText("Assisted (vacuum)")).toBeInTheDocument();
    expect(screen.getAllByText("Ngozi Okafor")).toHaveLength(1);
    fireEvent.click(screen.getByRole("tab", { name: "Birth Register" }));
    expect(await screen.findByText("BN-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("by Grace Nwangbo")).toBeInTheDocument();
  });

  it("registers a birth with the NPopC number typed in, never an invented one", async () => {
    render(<MemoryRouter><Labour /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("tab", { name: "Birth Register" }));
    fireEvent.click(await screen.findByRole("button", { name: /Register$/ }));
    const dialog = await screen.findByRole("dialog");
    const save = within(dialog).getByRole("button", { name: /Record registration/ });
    expect(save).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Civil registration number (from NPopC)"), { target: { value: "LA/IKJ/2026/004521" } });
    fireEvent.change(within(dialog).getByLabelText("Child's name (if now given)"), { target: { value: "Chiamaka Okafor" } });
    fireEvent.click(save);
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/births/r1/register", {
      method: "POST", version: 1, body: { registrationNumber: "LA/IKJ/2026/004521", babyName: "Chiamaka Okafor" },
    }));
  });
});

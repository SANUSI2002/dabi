import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ emrRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("./client")>()), emrRequest: api.emrRequest }));

import Appointments from "@/pages/clinical/Appointments";
import { appointmentFromApi, requestFromApi, scheduledAtFor, useLiveAppointments, type ApiAppointment, type ApiAppointmentRequest } from "./appointments";
import { liveRouteState } from "./routes";
import { useLiveEmr } from "./session";

const ORG = "11111111-1111-4111-8111-111111111111";
const patient = { id: "p1", medicalRecordNumber: "MRN-0000001", givenName: "Amaka", familyName: "Nwosu", dateOfBirth: "1992-02-14", sex: "FEMALE" as const };
const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
const appointment = (extra: Partial<ApiAppointment> = {}): ApiAppointment => ({
  id: "a1", patientId: "p1", scheduledAt: inMinutes(30), type: "FOLLOW_UP", reason: "BP review", status: "SCHEDULED", version: 1,
  providerUserId: "u2", providerName: "Tunde Bakare", encounterId: null, checkedInAt: null, patient, ...extra,
});

const visitRequest = (extra: Partial<ApiAppointmentRequest> = {}): ApiAppointmentRequest => ({
  id: "r1", status: "PENDING", requestedAt: inMinutes(24 * 60), appointmentType: "Follow-up", reason: "Knee pain", suggestedType: "FOLLOW_UP", appointmentId: null,
  requester: { userId: "s1", name: "Bola Ade", phone: "+2348000000000", email: "bola@sabi.test", dateOfBirth: "1988-03-04" },
  dependent: null, linkedPatient: null, ...extra,
});

let rows: ApiAppointment[] = [];
let requests: ApiAppointmentRequest[] = [];
beforeEach(() => {
  rows = [appointment(), appointment({ id: "a2", status: "NO_SHOW", type: "ANC", scheduledAt: inMinutes(-24 * 60), reason: null })];
  requests = [];
  api.emrRequest.mockReset();
  api.emrRequest.mockImplementation(async (path: string, options?: { method?: string }) => {
    if (path.startsWith("/appointments/requests?")) return { data: { items: requests } };
    if (path.startsWith("/appointments?")) return { data: { items: rows } };
    if (path.startsWith("/staff")) return { data: { items: [{ userId: "u2", name: "Tunde Bakare" }, { userId: "u3", name: "Grace Nwangbo" }] } };
    if (options?.method === "POST" && path.endsWith("/no-show")) throw Object.assign(new Error("The appointment time has not come yet."), { code: "INVALID_STATE" });
    return { data: {} };
  });
  useLiveAppointments.setState({ items: [], requests: [], clinicians: [], loaded: false, error: "" });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u1", name: "Adaeze Okonkwo", email: "desk@hospital.test", role: "Receptionist" },
    access: { organizationId: ORG, facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["RECEPTIONIST"], permissions: ["appointment.read", "appointment.manage", "patient.read"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("live appointment data", () => {
  it("maps a booking onto the screen's row and the form's local time onto an instant", () => {
    const local = new Date(2026, 9, 12, 9, 30);
    const row = appointmentFromApi(appointment({ scheduledAt: local.toISOString() }));
    expect(row).toMatchObject({ type: "Follow-up", status: "Scheduled", provider: "Tunde Bakare", time: "09:30", version: 1, patient: { firstName: "Amaka" } });
    expect(appointmentFromApi(appointment({ status: "NO_SHOW", providerName: null })).status).toBe("No-Show");
    expect(new Date(scheduledAtFor("2026-10-12", "09:30")).getTime()).toBe(local.getTime());
    expect(liveRouteState("/appointments", ["appointment.read"])).toBe("connected");
    expect(liveRouteState("/appointments", ["billing.read"])).toBe("no-permission");
  });

  it("maps a Sabi app request onto who it is for and the record it will use", () => {
    expect(requestFromApi(visitRequest({ linkedPatient: patient }))).toMatchObject({
      name: "Bola Ade", visit: "Follow-up", reason: "Knee pain", suggestedType: "Follow-up", forDependent: false, phone: "+2348000000000",
      dateOfBirth: "1988-03-04", linkedPatient: { id: "p1", mrn: "MRN-0000001" },
    });
    const child = requestFromApi(visitRequest({ appointmentType: null, suggestedType: "IMMUNIZATION", dependent: { id: "d1", fullName: "Tobi Ade", dateOfBirth: "2019-06-01", gender: "Male" } }));
    expect(child).toMatchObject({ name: "Tobi Ade", requestedBy: "Bola Ade", dateOfBirth: "2019-06-01", visit: "Hospital appointment", suggestedType: "Immunization", forDependent: true, linkedPatient: undefined });
  });
});

describe("the live Appointments screen", () => {
  it("lists the hospital's bookings, checks a patient in and shows what the hospital refused", async () => {
    render(<MemoryRouter><Appointments /></MemoryRouter>);
    expect(await screen.findByText("BP review")).toBeTruthy();
    expect(screen.getByText("No-shows").parentElement?.textContent).toContain("1");
    const scheduled = screen.getByText("BP review").closest("tr") as HTMLElement;

    fireEvent.click(within(scheduled).getByRole("button", { name: "No-show" }));
    expect(await screen.findByText("The appointment time has not come yet.")).toBeTruthy();

    fireEvent.click(within(scheduled).getByRole("button", { name: "Check in" }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/appointments/a1/check-in", { method: "POST", version: 1, body: {} }));
  });

  it("confirms a Sabi app request on the linked record, and rejects another with a reason", async () => {
    requests = [visitRequest({ linkedPatient: patient }), visitRequest({ id: "r2", reason: "Cough", appointmentType: "Consultation", suggestedType: "GENERAL" })];
    render(<MemoryRouter><Appointments /></MemoryRouter>);
    expect(await screen.findByText("Requests from the Sabi app (2)")).toBeTruthy();
    const linked = screen.getByText("Knee pain").closest("tr") as HTMLElement;
    expect(within(linked).getByText("MRN-0000001")).toBeTruthy();
    expect(within(screen.getByText("Cough").closest("tr") as HTMLElement).getByText("Not linked")).toBeTruthy();

    fireEvent.click(within(linked).getByRole("button", { name: "Confirm" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Amaka Nwosu · MRN-0000001/)).toBeTruthy();
    const [type, provider] = within(dialog).getAllByRole("combobox") as HTMLSelectElement[];
    expect(type.value).toBe("Follow-up");
    fireEvent.change(provider, { target: { value: "u2" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm Appointment" }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/appointments/requests/r1/confirm", {
      method: "POST", idempotencyKey: expect.any(String), body: { type: "FOLLOW_UP", providerUserId: "u2" },
    }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(within(screen.getByText("Cough").closest("tr") as HTMLElement).getByRole("button", { name: "Reject" }));
    const rejecting = await screen.findByRole("dialog");
    const submit = within(rejecting).getByRole("button", { name: "Reject Request" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(rejecting.querySelector("textarea") as HTMLTextAreaElement, { target: { value: "Clinic closed that day" } });
    fireEvent.click(submit);
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/appointments/requests/r2/reject", { method: "POST", body: { reason: "Clinic closed that day" } }));
  });

  it("asks the desk for the record of an unlinked patient and shows what the hospital refused", async () => {
    requests = [visitRequest()];
    api.emrRequest.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path.startsWith("/appointments/requests?")) return { data: { items: requests } };
      if (path.startsWith("/appointments?")) return { data: { items: [] } };
      if (path.startsWith("/patients?")) return { data: { items: [patient] } };
      if (path.startsWith("/staff")) return { data: { items: [] } };
      if (options?.method === "POST" && path.endsWith("/confirm")) {
        throw Object.assign(new Error("The time the patient asked for has passed. Reject the request so they can ask for another time."), { code: "INVALID_STATE" });
      }
      return { data: {} };
    });
    render(<MemoryRouter><Appointments /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Not linked to their Sabi account yet/).textContent).toContain("Phone +2348000000000");
    const confirmButton = within(dialog).getByRole("button", { name: "Confirm Appointment" }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);
    const search = within(dialog).getByPlaceholderText("Search by name, MRN, phone…");
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "Amaka" } });
    fireEvent.mouseDown(await within(dialog).findByRole("button", { name: /Amaka Nwosu/ }));
    fireEvent.click(confirmButton);
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/appointments/requests/r1/confirm", {
      method: "POST", idempotencyKey: expect.any(String), body: { patientId: "p1", type: "FOLLOW_UP" },
    }));
    expect(await within(dialog).findByText(/The time the patient asked for has passed/)).toBeTruthy();
  });

  it("books with a clinician from the hospital, once per request", async () => {
    api.emrRequest.mockImplementation(async (path: string) => {
      if (path.startsWith("/appointments/requests?")) return { data: { items: [] } };
      if (path.startsWith("/appointments?")) return { data: { items: [] } };
      if (path.startsWith("/patients?")) return { data: { items: [patient] } };
      if (path.startsWith("/staff")) return { data: { items: [{ userId: "u2", name: "Tunde Bakare" }] } };
      return { data: {} };
    });
    render(<MemoryRouter><Appointments /></MemoryRouter>);
    expect(await screen.findByText("No appointments booked.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Book Appointment/ }));
    const dialog = await screen.findByRole("dialog");
    const search = within(dialog).getByPlaceholderText("Search by name, MRN, phone…");
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "Amaka" } });
    fireEvent.mouseDown(await within(dialog).findByRole("button", { name: /Amaka Nwosu/ }));
    fireEvent.change(dialog.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: "2026-10-12" } });
    fireEvent.change(dialog.querySelector('input[type="time"]') as HTMLInputElement, { target: { value: "10:15" } });
    const [type, provider] = within(dialog).getAllByRole("combobox");
    fireEvent.change(type, { target: { value: "Follow-up" } });
    fireEvent.change(provider, { target: { value: "u2" } });
    fireEvent.change(dialog.querySelector("textarea") as HTMLTextAreaElement, { target: { value: "Diabetes review" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Book Appointment" }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/appointments", expect.objectContaining({
      method: "POST", idempotencyKey: expect.any(String),
      body: { patientId: "p1", scheduledAt: scheduledAtFor("2026-10-12", "10:15"), type: "FOLLOW_UP", providerUserId: "u2", reason: "Diabetes review" },
    })));
  });
});

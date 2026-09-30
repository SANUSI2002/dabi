import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/config/runtime")>()),
  apiBaseUrl: "https://api.test",
  apiConfigured: true,
}));

import Registration from "@/pages/clinical/Registration";
import { emrRequest } from "./client";
import { patientFromApi, registrationToApi, type ApiPatient, type RegistrationForm } from "./mappers";
import { useLiveQueue } from "./queue";
import { useLiveEmr } from "./session";
import { vitalsReadings } from "./vitals";

const ORG = "11111111-1111-4111-8111-111111111111";
const EMR = `https://api.test/api/v1/emr/organizations/${ORG}`;

type Call = { method: string; url: string; headers: Record<string, string>; body: unknown };
type Handler = (call: Call) => { status?: number; body: unknown } | undefined;

/** A stand-in for the Sabi API: identity routes plus whatever EMR routes a test adds. */
function fakeApi(emr: Handler) {
  const calls: Call[] = [];
  let switches = 0;
  const fetcher = vi.fn(async (url: string, init: RequestInit = {}) => {
    const call: Call = {
      method: init.method ?? "GET",
      url,
      headers: (init.headers ?? {}) as Record<string, string>,
      body: init.body ? JSON.parse(init.body as string) : undefined,
    };
    calls.push(call);
    const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    if (url.endsWith("/api/v1/auth/refresh")) return reply(200, { accessToken: "session-token" });
    if (url.endsWith("/api/v1/auth/me")) return reply(200, { user: { id: "u1", email: "desk@hospital.test", fullName: "Ada Desk", roles: [] }, organizations: [] });
    if (url.endsWith("/api/v1/auth/platform-assignment")) return reply(403, { error: { code: "PLATFORM_ACCESS_DENIED", message: "Access denied." } });
    if (url.endsWith("/api/v1/auth/organizations/switch")) { switches += 1; return reply(200, { accessToken: `org-token-${switches}` }); }
    if (url.endsWith(`/api/v1/auth/organizations/${ORG}/emr-access`)) {
      return reply(200, { data: { organizationId: ORG, facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["RECEPTIONIST"], permissions: ["patient.read", "patient.register", "queue.read", "queue.manage"], clinicalApiConnected: true, patientRegistryEnabled: true } });
    }
    const handled = emr(call);
    if (handled) return reply(handled.status ?? 200, handled.body);
    throw new Error(`Unexpected request: ${call.method} ${url}`);
  });
  vi.stubGlobal("fetch", fetcher);
  return { calls, emrCalls: () => calls.filter((call) => call.url.startsWith(EMR)), switches: () => switches };
}

const apiPatient = (extra: Partial<ApiPatient> = {}): ApiPatient => ({
  id: "p-1", medicalRecordNumber: "MRN-0000001", givenName: "Bisi", familyName: "Adeyemi", dateOfBirth: "1990-04-12", sex: "FEMALE",
  phone: "+2348030000001", address: "4 Marina Road", state: "Lagos", lga: "Lagos Island", payer: "NHIS", category: "GEN", createdAt: "2026-09-01T09:00:00.000Z",
  ...extra,
});

beforeEach(() => {
  useLiveEmr.setState({ status: "idle", access: null, user: null, error: "" });
  useLiveQueue.getState().reset();
});

afterEach(async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
  await useLiveEmr.getState().signOut();
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe("live EMR session", () => {
  it("opens only after the backend verifies the hospital, and remembers just the hospital id for this tab", async () => {
    fakeApi(() => undefined);
    const access = await useLiveEmr.getState().start(ORG);
    expect(access?.organizationName).toBe("Sabi Test General Hospital");
    expect(useLiveEmr.getState()).toMatchObject({ status: "ready", user: { name: "Ada Desk", email: "desk@hospital.test", role: "Receptionist" } });
    expect(window.sessionStorage.getItem("sabi.liveEmr.organizationId")).toBe(ORG);
    expect(JSON.stringify(window.sessionStorage)).not.toContain("token");
  });

  it("re-selects the hospital once when the short-lived token expires, then retries", async () => {
    let first = true;
    const api = fakeApi((call) => {
      if (call.url === `${EMR}/queue?status=WAITING`) {
        if (first) { first = false; return { status: 401, body: { status: "error", message: "Authentication required" } }; }
        return { body: { data: { items: [] } } };
      }
      return undefined;
    });
    await useLiveEmr.getState().start(ORG);
    await emrRequest(`/queue?status=WAITING`);
    expect(api.switches()).toBe(2);
    expect(api.emrCalls().map((call) => call.headers.Authorization)).toEqual(["Bearer org-token-1", "Bearer org-token-2"]);
  });
});

describe("live registration screen", () => {
  it("lists the hospital's patients from the server and registers a new one exactly once", async () => {
    const created = apiPatient({ id: "p-2", medicalRecordNumber: "MRN-0000002", givenName: "Tunde", familyName: "Okafor", sex: "MALE", payer: "OUT_OF_POCKET" });
    let registered = false;
    const api = fakeApi((call) => {
      if (call.method === "GET" && call.url.startsWith(`${EMR}/patients?limit=100`)) {
        return { body: { data: { items: registered ? [created, apiPatient()] : [apiPatient()], total: registered ? 2 : 1, nextCursor: null } } };
      }
      if (call.method === "GET" && call.url === `${EMR}/patients/duplicate-pairs`) return { body: { data: { items: [] } } };
      if (call.method === "GET" && call.url.startsWith(`${EMR}/patients/duplicates?`)) return { body: { data: { items: [] } } };
      if (call.method === "POST" && call.url === `${EMR}/patients`) { registered = true; return { status: 201, body: { data: created } }; }
      return undefined;
    });
    await useLiveEmr.getState().start(ORG);

    render(<MemoryRouter><Registration /></MemoryRouter>);
    expect(await screen.findByText("Bisi Adeyemi")).toBeTruthy();
    expect(screen.getByText("1 patients on file")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /New patient/ }));
    fireEvent.change(screen.getByLabelText("Surname *"), { target: { value: "Okafor" } });
    fireEvent.change(screen.getByLabelText("First name *"), { target: { value: "Tunde" } });
    fireEvent.change(screen.getByLabelText("Date of birth *"), { target: { value: "1988-02-03" } });
    fireEvent.change(screen.getByLabelText("Sex"), { target: { value: "M" } });
    fireEvent.click(screen.getByRole("button", { name: "Register patient" }));

    expect(await screen.findByText("Tunde Okafor")).toBeTruthy();
    expect(screen.getByText("2 patients on file")).toBeTruthy();
    const posts = api.emrCalls().filter((call) => call.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0].headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(posts[0].body).toEqual({
      givenName: "Tunde", familyName: "Okafor", dateOfBirth: "1988-02-03", sex: "MALE", consentToContact: false,
      lga: "Amuwo-Odofin", state: "Lagos", category: "GEN", payer: "OUT_OF_POCKET",
    });
  });

  it("shows the server's reason when a registration is refused", async () => {
    fakeApi((call) => {
      if (call.method === "GET" && call.url.startsWith(`${EMR}/patients`)) return { body: { data: { items: [], total: 0 } } };
      if (call.method === "POST" && call.url === `${EMR}/patients`) {
        return { status: 409, body: { status: "error", error: { code: "HOSPITAL_NUMBER_IN_USE", message: "Another patient in this organization already has this hospital number." } } };
      }
      return undefined;
    });
    await useLiveEmr.getState().start(ORG);
    render(<MemoryRouter><Registration /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /New patient/ }));
    fireEvent.change(screen.getByLabelText("Surname *"), { target: { value: "Okafor" } });
    fireEvent.change(screen.getByLabelText("First name *"), { target: { value: "Tunde" } });
    fireEvent.change(screen.getByLabelText("Date of birth *"), { target: { value: "1988-02-03" } });
    fireEvent.click(screen.getByRole("button", { name: "Register patient" }));
    expect((await screen.findByRole("alert")).textContent).toContain("already has this hospital number");
    expect(screen.getByRole("button", { name: "Register patient" })).toBeTruthy(); // the form stays open to correct
  });
});

describe("live queue", () => {
  it("says nobody is waiting instead of failing, and sends the version with every change", async () => {
    const api = fakeApi((call) => {
      if (call.url === `${EMR}/queue/call-next`) return { status: 404, body: { status: "error", error: { code: "NOTHING_WAITING", message: "Nobody is waiting." } } };
      if (call.method === "PATCH" && call.url === `${EMR}/queue/q-1`) return { body: { data: {} } };
      if (call.method === "GET" && call.url.startsWith(`${EMR}/queue?`)) return { body: { data: { items: [] } } };
      return undefined;
    });
    await useLiveEmr.getState().start(ORG);
    expect(await useLiveQueue.getState().callNext("Lab")).toBeNull();
    expect(api.emrCalls()[0].body).toEqual({ station: "Lab" });

    const entry = { id: "q-1", version: 3 } as Parameters<ReturnType<typeof useLiveQueue.getState>["update"]>[0];
    await useLiveQueue.getState().update(entry, { station: "Consultation", priority: "Urgent", status: "Waiting" });
    const patch = api.emrCalls().find((call) => call.method === "PATCH");
    expect(patch?.headers["If-Match"]).toBe('W/"3"');
    expect(patch?.body).toEqual({ station: "Consultation", status: "WAITING", priority: "URGENT" });
  });
});

describe("mapping between the screens and the API", () => {
  it("keeps records the registration form cannot produce readable, and never sends blank optional fields", () => {
    expect(patientFromApi(apiPatient({ sex: "UNKNOWN", payer: null, address: null, reportedAllergies: "Penicillin" }))).toMatchObject({
      sex: "Unknown", payer: "Out of Pocket", address: "", allergies: "Penicillin", mrn: "MRN-0000001", firstName: "Bisi",
    });
    const form: RegistrationForm = {
      firstName: " Ada ", lastName: "Obi", otherName: "", preferredName: "", sex: "F", dob: "1990-01-01", phone: " ", consentToContact: true,
      address: "", lga: "", state: "", ward: "Ward 4", language: "", occupation: "", category: "GEN", payer: "Government Scheme",
      nin: "123 456 789 01", hospitalNumber: "", bloodGroup: "", allergies: "", nextOfKin: "", nokPhone: "", nokRelation: "",
      emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelation: "",
    };
    expect(registrationToApi(form)).toEqual({
      givenName: "Ada", familyName: "Obi", dateOfBirth: "1990-01-01", sex: "FEMALE", consentToContact: true,
      addressWard: "Ward 4", category: "GEN", payer: "GOVERNMENT_SCHEME", nationalId: "12345678901",
    });
  });

  it("turns the vitals form into coded readings and rejects an unreadable blood pressure", () => {
    expect(vitalsReadings({ bp: "120 / 80", temp: 37.4, muac: 11.5, spo2: undefined })).toEqual([
      { code: "BP_SYSTOLIC", value: 120 }, { code: "BP_DIASTOLIC", value: 80 }, { code: "TEMPERATURE", value: 37.4 }, { code: "MUAC", value: 11.5 },
    ]);
    expect(() => vitalsReadings({ bp: "12080" })).toThrow(/systolic\/diastolic/);
  });
});

describe("demo mode is untouched", () => {
  it("does not call the network when no live hospital is open", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    render(<MemoryRouter><Registration /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/patients on file/)).toBeTruthy());
    expect(fetcher).not.toHaveBeenCalled();
  });
});

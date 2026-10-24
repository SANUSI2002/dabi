import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ emrRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("./client")>()), emrRequest: api.emrRequest }));

import Referrals from "@/pages/programs/Referrals";
import { referralFromApi, useLiveReferrals, type ApiReferral } from "./referrals";
import { liveRouteState } from "./routes";
import { useLiveEmr } from "./session";

const person = { id: "p1", medicalRecordNumber: "MRN-0000031", givenName: "Amaka", familyName: "Obi", dateOfBirth: "1994-05-01", sex: "FEMALE" as const };
const base: ApiReferral = {
  id: "r1", patientId: "p1", patient: person, version: 2, direction: "OUT", destination: "General Hospital, Amuwo", diagnosis: "Severe pre-eclampsia", reason: "Complicated Cases",
  urgency: "URGENT", status: "ACCEPTED", clinicalSummary: "BP 170/112", attachments: [], referredByName: "Grace Nwangbo", sourceReferralId: null, receivingClinician: "Dr. Bello",
  declineReason: null, appointmentDate: null, attendedAt: null, feedback: null, createdAt: new Date().toISOString(),
};
const inbound: ApiReferral = { ...base, id: "r2", direction: "IN", status: "REQUESTED", version: 1, reason: "Other Reasons", urgency: "ROUTINE", referredByName: "Dr. Bello", sourceReferralId: "r0" };

beforeEach(() => {
  api.emrRequest.mockReset();
  api.emrRequest.mockImplementation(async (path: string) => (path.startsWith("/referrals?") ? { data: { items: [base, inbound] } } : { data: {} }));
  useLiveReferrals.setState({ referrals: [], error: "" });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u3", name: "Grace Nwangbo", email: "nurse@hospital.test", role: "Nurse" },
    access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["NURSE"], permissions: ["referral.read", "referral.manage", "patient.read"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("live referrals", () => {
  it("are connected, and map direction, status and urgency", () => {
    expect(liveRouteState("/referrals", ["referral.read"])).toBe("connected");
    expect(referralFromApi(base)).toMatchObject({ type: "Out", status: "Accepted", urgency: "Urgent", facility: "General Hospital, Amuwo", referredBy: "Grace Nwangbo" });
    expect(referralFromApi(inbound).type).toBe("In");
  });

  it("schedules an accepted referral in the hospital's EMR", async () => {
    render(<MemoryRouter><Referrals /></MemoryRouter>);
    expect(await screen.findByText("Severe pre-eclampsia")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Schedule appointment/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(dialog.querySelector('input[type="date"]')!, { target: { value: "2099-01-05" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Schedule" }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/referrals/r1/schedule", { method: "POST", version: 2, body: { appointmentDate: "2099-01-05" } }));
  });

  it("records the outcome with a back-referral", async () => {
    render(<MemoryRouter><Referrals /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Record outcome/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(dialog.querySelector("textarea")!, { target: { value: "Delivered by CS, stable" } });
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(within(dialog).getByRole("button", { name: /close the loop/ }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/referrals/r1/outcome", { method: "POST", version: 2, body: { outcome: "Treated & discharged", note: "Delivered by CS, stable", by: "Dr. Bello", backReferral: true } }));
  });
});

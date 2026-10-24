import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ emrRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("./client")>()), emrRequest: api.emrRequest }));

import Transfers from "@/pages/clinical/Transfers";
import { transferFromApi, useLiveTransfers, type ApiTransfer } from "./transfers";
import { liveRouteState } from "./routes";
import { useLiveEmr } from "./session";

const person = { id: "p1", medicalRecordNumber: "MRN-0000041", givenName: "Tayo", familyName: "Bello", dateOfBirth: "1980-01-01", sex: "MALE" as const };
const pending: ApiTransfer = {
  id: "t1", version: 1, direction: "OUT", patientId: "p1", patient: person, patientName: "Tayo Bello", facility: "PHC Kirikiri", reason: "Relocation", summary: null,
  status: "PENDING", recordsSent: false, initiatedByName: "Adaeze Okonkwo", completedByName: null, completedAt: null, cancelledAt: null, createdAt: "2026-10-18T09:00:00.000Z",
};

beforeEach(() => {
  api.emrRequest.mockReset();
  api.emrRequest.mockImplementation(async (path: string) => (path.startsWith("/transfers?") ? { data: { items: [pending] } } : { data: {} }));
  useLiveTransfers.setState({ transfers: [], error: "" });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u1", name: "Adaeze Okonkwo", email: "desk@hospital.test", role: "Receptionist" },
    access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["RECEPTIONIST"], permissions: ["transfer.read", "transfer.manage", "patient.read"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("live patient transfers", () => {
  it("are connected and mapped", () => {
    expect(liveRouteState("/transfers", ["transfer.read"])).toBe("connected");
    expect(transferFromApi({ ...pending, status: "COMPLETED", recordsSent: true, completedByName: "Grace" })).toMatchObject({ direction: "Out", status: "Completed", recordsSent: true, handledBy: "Grace" });
  });

  it("completes a pending transfer in the hospital's EMR", async () => {
    render(<MemoryRouter><Transfers /></MemoryRouter>);
    expect((await screen.findAllByText("PHC Kirikiri")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Complete/ }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/transfers/t1/complete", { method: "POST", version: 1, body: {} }));
  });

  it("records an inbound transfer by name", async () => {
    render(<MemoryRouter><Transfers /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /New transfer/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getAllByRole("combobox")[0], { target: { value: "In" } });
    const boxes = within(dialog).getAllByRole("textbox");
    fireEvent.change(boxes[0], { target: { value: "Halima Musa" } });
    fireEvent.change(boxes[1], { target: { value: "General Hospital, Ikorodu" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Initiate transfer" }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/transfers", expect.objectContaining({ method: "POST", body: { direction: "IN", patientName: "Halima Musa", facility: "General Hospital, Ikorodu", reason: "Relocation" } })));
  });
});

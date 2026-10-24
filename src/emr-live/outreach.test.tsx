import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ emrRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("./client")>()), emrRequest: api.emrRequest }));

import Outreach from "@/pages/programs/Outreach";
import { outreachFromApi, useLiveOutreach, type ApiOutreach } from "./outreach";
import { liveRouteState } from "./routes";
import { useLiveEmr } from "./session";

const visit: ApiOutreach = { id: "o1", chwUserId: "c1", chwName: "Musa Danjuma", activityType: "Defaulter tracing", ward: "Ajegunle", households: 9, referrals: 3, activityDate: "2026-10-18", notes: "Two Penta 3 defaulters traced", status: "ACTIVE", recordedByName: "Grace Nwangbo", createdAt: "2026-10-18T12:00:00.000Z" };

beforeEach(() => {
  api.emrRequest.mockReset();
  api.emrRequest.mockImplementation(async (path: string) =>
    path.startsWith("/outreach?") ? { data: { items: [visit] } } : path === "/staff?permission=outreach.chw" ? { data: { items: [{ userId: "c1", name: "Musa Danjuma" }] } } : { data: {} });
  useLiveOutreach.setState({ activities: [], chws: [], error: "" });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u3", name: "Grace Nwangbo", email: "nurse@hospital.test", role: "Nurse" },
    access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["NURSE"], permissions: ["outreach.read", "outreach.record"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("live community outreach", () => {
  it("is connected and mapped", () => {
    expect(liveRouteState("/outreach", ["outreach.read"])).toBe("connected");
    expect(outreachFromApi(visit)).toMatchObject({ chw: "Musa Danjuma", type: "Defaulter tracing", households: 9, referrals: 3, date: "2026-10-18" });
  });

  it("shows the live log and logs an activity for a CHW on the roster", async () => {
    render(<MemoryRouter><Outreach /></MemoryRouter>);
    expect(await screen.findByText("Ajegunle")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Log Activity/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(dialog.querySelector('input[type="date"]')!, { target: { value: "2026-10-19" } });
    const numbers = dialog.querySelectorAll('input[type="number"]');
    fireEvent.change(numbers[0], { target: { value: "12" } });
    fireEvent.change(numbers[1], { target: { value: "1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Activity" }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/outreach", expect.objectContaining({
      method: "POST", body: { chwUserId: "c1", activityType: "Household visit", ward: "Kirikiri", households: 12, referrals: 1, activityDate: "2026-10-19" },
    })));
  });
});

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ emrRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/emr-live/client")>()), emrRequest: api.emrRequest }));

import { DrugField } from "./DrugField";
import { useLiveEmr } from "@/emr-live/session";

const amox = { code: "AMOX500", genericName: "Amoxicillin", strength: "500 mg", doseUnit: "mg", inStock: 120 };
const reads = () => api.emrRequest.mock.calls.map(([path]) => path as string);

beforeEach(() => {
  api.emrRequest.mockReset();
  api.emrRequest.mockImplementation(async (path: string) => (path.startsWith("/pharmacy/drug-search")
    ? { data: { formulary: path.includes("source=emdex") ? [] : [amox], reference: [], referenceStatus: path.includes("source=emdex") ? "not_configured" : "ok" } }
    : { data: { items: [amox] } }));
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u1", name: "Tunde Bakare", email: "doctor@hospital.test", role: "Doctor" },
    access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["DOCTOR"], permissions: ["prescription.create"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("the prescriber's drug search", () => {
  it("browses the pharmacy by category and picks a stocked drug", async () => {
    const onChange = vi.fn();
    render(<DrugField value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Drug category"), { target: { value: "ANTIBIOTIC" } });
    await waitFor(() => expect(reads()).toContain("/pharmacy/drug-search?source=formulary&category=ANTIBIOTIC"));
    fireEvent.mouseDown(await screen.findByText("Amoxicillin"));
    expect(onChange).toHaveBeenCalledWith("Amoxicillin 500 mg", { code: "AMOX500", doseUnit: "mg" });
  });

  it("searches EMDEX by name when the prescriber chooses it, and says when it isn't set up", async () => {
    render(<DrugField value="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "EMDEX" }));
    expect(screen.getByRole("button", { name: "EMDEX" })).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByText(/Type a drug or brand name to search EMDEX/)).toBeInTheDocument();
    await act(async () => { fireEvent.change(screen.getByPlaceholderText(/Search EMDEX/), { target: { value: "amlodipine" } }); });
    await waitFor(() => expect(reads()).toContain("/pharmacy/drug-search?source=emdex&q=amlodipine"));
    expect(await screen.findByText(/EMDEX search isn't set up for this hospital yet — choose Pharmacy/)).toBeInTheDocument();
  });
});

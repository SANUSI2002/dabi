import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ emrRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("./client")>()), emrRequest: api.emrRequest }));

import LabTestSettings from "@/pages/diagnostics/LabTestSettings";
import { analytesFromTemplate, liveLabTest, templateFromAnalytes, useLiveLabCatalog, type ApiLabTest, type LabAnalyte } from "./lab";
import { useLiveEmr } from "./session";

const hb: LabAnalyte = { code: "HB", name: "Haemoglobin", kind: "NUMERIC", unit: "g/dL", low: 12, high: 17, criticalLow: 7, female: { low: 12, high: 15.5 } };
const mp: LabAnalyte = { code: "MP", name: "Malaria parasites", kind: "CHOICE", options: ["NEGATIVE", "POSITIVE"], normal: ["NEGATIVE"] };
const fbc: ApiLabTest = { id: "t1", code: "FBC", name: "Full blood count", section: "Haematology", specimenType: "Whole blood", analytes: [hb], turnaroundMinutes: 60, phases: [], active: true, version: 3 };

beforeEach(() => {
  api.emrRequest.mockReset();
  api.emrRequest.mockImplementation(async (path: string) => (path === "/lab/tests" ? { data: { items: [fbc] } } : { data: {} }));
  useLiveLabCatalog.setState({ tests: [], error: "" });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u5", name: "Kemi Adeola", email: "lab@hospital.test", role: "Lab Scientist" },
    access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["LAB_SCIENTIST"], permissions: ["lab.order.read", "lab.catalog.manage", "lab.result.create"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("live lab test settings", () => {
  it("maps the result template onto analytes without losing hidden settings", () => {
    const template = templateFromAnalytes([hb, mp]);
    expect(template).toEqual([
      expect.objectContaining({ id: "HB", label: "Haemoglobin", unit: "g/dL", refRange: "12–17", type: "number" }),
      expect.objectContaining({ id: "MP", type: "select", refRange: "NEGATIVE" }),
    ]);
    const edited = analytesFromTemplate([{ ...template[0], refRange: "11-16" }, template[1], { id: "x", label: "Retic count", unit: "%", refRange: "≤ 2", type: "number" }], [hb, mp]);
    expect(edited[0]).toEqual({ code: "HB", name: "Haemoglobin", kind: "NUMERIC", unit: "g/dL", low: 11, high: 16, criticalLow: 7, female: { low: 12, high: 15.5 } });
    expect(edited[1]).toEqual(mp);
    expect(edited[2]).toEqual({ code: "RETIC_COUNT", name: "Retic count", kind: "NUMERIC", unit: "%", high: 2 });
    expect(() => analytesFromTemplate([{ id: "y", label: "Odd", refRange: "high", type: "number" }], [])).toThrow(/reference range/);
    expect(() => analytesFromTemplate([{ id: "z", label: "Colour", type: "select" }], [])).toThrow(/choices/);
  });

  it("carries phases, progress and turnaround onto the bench card", () => {
    const order = { id: "o1", patientId: "p1", encounterId: "e1", status: "COLLECTED", priority: "ROUTINE", accessionNumber: "LAB-2026-000001", version: 2, createdAt: "2026-10-20T08:00:00.000Z", orderedByName: "Dr", collectedAt: "2026-10-20T08:05:00.000Z", collectedByName: "Nurse", specimenNote: null, cancelledAt: null, cancelledByName: null, cancellationReason: null,
      patient: { id: "p1", medicalRecordNumber: "MRN-1", givenName: "A", familyName: "B", dateOfBirth: "1990-01-01", sex: "FEMALE" }, items: [] } as unknown as Parameters<typeof liveLabTest>[0];
    const item = { id: "i1", testCode: "FBC", testName: "Full blood count", specimenType: "Whole blood", analytes: [hb], status: "PENDING", version: 2, phases: ["Spin", "Count"], phaseIndex: 1, turnaroundMinutes: 45,
      phaseLog: [{ position: 0, phase: "Spin", completedByName: "Kemi Adeola", completedAt: "2026-10-20T08:20:00.000Z" }], results: [] } as unknown as Parameters<typeof liveLabTest>[1];
    expect(liveLabTest(order, item)).toMatchObject({ phases: ["Spin", "Count"], phaseIndex: 1, turnaroundMinutes: 45, phaseLog: [{ name: "Spin", by: "Kemi Adeola" }] });
  });

  it("saves turnaround and phases to the hospital's catalog", async () => {
    render(<MemoryRouter><LabTestSettings /></MemoryRouter>);
    expect(await screen.findByText("Full blood count")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Configure/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(dialog.querySelector('input[type="number"]')!, { target: { value: "45" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Add phase/ }));
    const inputs = within(dialog).getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "Centrifuge" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save configuration" }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/lab/tests/FBC", expect.objectContaining({
      method: "PATCH", version: 3, body: expect.objectContaining({ turnaroundMinutes: 45, phases: ["Centrifuge"], analytes: [expect.objectContaining({ code: "HB", criticalLow: 7 })] }),
    })));
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ accountingRequest: vi.fn(), accountingUpload: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/emr-live/client")>()), ...api }));

import { Attachments } from "@/pages/accounting/_attachments";
import { useLiveEmr } from "@/emr-live/session";
import { useDocuments } from "@/store/accounting/useDocuments";
import { goLiveAttachments, loadAttachments, useLiveAttachmentsMeta } from "./attachments";

const BILL = "00000000-0000-4000-8000-0000000000b1";
const file = (status: string, extra = {}) => ({ id: `a-${status}`, entityType: "bill", entityId: BILL, entityLabel: "BILL-1", filename: `${status.toLowerCase()}.pdf`, mimeType: "application/pdf", sizeKb: 12, version: 1, status, uploadedBy: "Ngozi Eze", uploadedAt: "2026-10-23T10:00:00.000Z", ...extra });
const list = (enabled: boolean, items: unknown[] = []) => ({ data: { enabled, maxBytes: 3_500_000, contentTypes: ["application/pdf", "image/jpeg", "image/png"], items } });
const signIn = () => useLiveEmr.setState({
  status: "ready", error: "", user: { id: "u1", name: "Ngozi Eze", email: "finance@hospital.test", role: "Finance Officer" },
  access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["FINANCE_OFFICER"], permissions: ["acct.view", "acct.post"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
});
const block = () => render(<Attachments entityType="bill" entityId={BILL} entityLabel="BILL-1" />);
beforeEach(() => { api.accountingRequest.mockReset(); api.accountingUpload.mockReset(); });
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); useLiveAttachmentsMeta.setState({ loaded: false, enabled: false, error: "", uploading: [] }); });

describe("live accounting attachments", () => {
  it("say so when the deployment has no document storage or scanner", async () => {
    signIn();
    api.accountingRequest.mockResolvedValue(list(false));
    await loadAttachments();
    block();
    expect(screen.getByRole("button", { name: /Attach/ })).toBeDisabled();
    expect(screen.getByText(/isn't set up for this deployment/)).toBeInTheDocument();
  });

  it("send the file itself, then show it being checked, and open only a clean one", async () => {
    signIn();
    api.accountingRequest.mockResolvedValue(list(true, [file("CLEAN"), file("INFECTED"), file("PENDING_SCAN")]));
    api.accountingUpload.mockResolvedValue({ data: file("PENDING_SCAN") });
    goLiveAttachments();
    await loadAttachments();
    block();
    expect(screen.getByText("Checking for viruses…")).toBeInTheDocument();
    expect(screen.getByText("Failed the security check")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(1); // only the clean file
    const pdf = new File(["%PDF-1.4 synthetic"], "emzor invoice.pdf", { type: "application/pdf" });
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [pdf] } });
    await waitFor(() => expect(api.accountingUpload).toHaveBeenCalledWith(`/attachments/receive?entityType=bill&entityId=${BILL}&entityLabel=BILL-1`, pdf, { "X-Document-Filename": "emzor%20invoice.pdf", "Idempotency-Key": expect.any(String) }));
    api.accountingRequest.mockResolvedValueOnce({ data: { url: "https://storage.test/signed" } });
    const opened = vi.spyOn(window, "open").mockReturnValue(null);
    fireEvent.click(screen.getByRole("button", { name: "Open clean.pdf" }));
    await waitFor(() => expect(opened).toHaveBeenCalledWith("https://storage.test/signed", "_blank", "noopener"));
    expect(api.accountingRequest).toHaveBeenCalledWith("/attachments/a-CLEAN/download", { method: "POST", body: {} });
  });

  it("refuse a file of the wrong type before sending it", async () => {
    signIn();
    api.accountingRequest.mockResolvedValue(list(true));
    await loadAttachments();
    block();
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(["x"], "notes.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })] } });
    expect(await screen.findByText("Attach a PDF, JPEG or PNG file.")).toBeInTheDocument();
    expect(api.accountingUpload).not.toHaveBeenCalled();
    expect(useDocuments.getState().attachments).toEqual([]);
  });

  it("keep working on the sample data", () => {
    block();
    expect(screen.getByRole("button", { name: /Attach/ })).toBeEnabled();
  });
});

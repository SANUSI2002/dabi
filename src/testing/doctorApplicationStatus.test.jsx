import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import RegistrationStatusPage from "../../apps/telemedicine/packages/doctor-portal/src/pages/auth/RegistrationStatusPage.jsx";
const request = vi.fn();
vi.mock("../../apps/telemedicine/packages/doctor-portal/src/services/doctorAuth.js", () => ({ AUTH_CONFIGURED: true, doctorOnboardingRequest: (...args) => request(...args), resendVerification: vi.fn(), verifyEmail: vi.fn() }));
vi.mock("../../apps/telemedicine/packages/doctor-portal/src/pages/auth/AuthLayout.jsx", () => ({ default: ({ children }) => <main>{children}</main> }));
const base = { applicationId: "11111111-1111-4111-8111-111111111111", email: "synthetic@example.test", status: "PENDING", maxUploadBytes: 3500000, credentials: [], blockers: [] };
const credential = (kind) => ({ id: kind, kind, scanStatus: "PENDING", reviewStatus: "PENDING" });
let application;
beforeEach(() => {
  application = structuredClone(base); request.mockReset(); vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  request.mockImplementation(async (path, options) => {
    if (options?.method === "PUT") { const kind = path.split("/").at(-1); application.credentials.push(credential(kind)); application.submittedAt = null; return { data: credential(kind) }; }
    if (options?.method === "POST") { application.submittedAt = "2026-10-05T22:45:00Z"; return { data: { submitted: true, submittedAt: application.submittedAt } }; }
    return { data: structuredClone(application) };
  });
});
const mount = () => render(<MemoryRouter><RegistrationStatusPage /></MemoryRouter>);
const select = (kind, type = "application/pdf", size = 50) => fireEvent.change(document.getElementById(kind), { target: { files: [new File([new Uint8Array(size)], `${kind}.pdf`, { type })] } });
describe("doctor onboarding matches the applicant workflow", () => {
  it("selecting both files uploads automatically; final submission confirms prominently", async () => {
    mount(); await screen.findByText("Upload your credentials");
    select("licence"); await waitFor(() => expect(screen.getByText("Document uploaded")).toBeInTheDocument());
    await waitFor(() => expect(document.getElementById("registrationCertificate")).toBeEnabled());
    select("registrationCertificate"); await waitFor(() => expect(screen.getAllByText("Document uploaded")).toHaveLength(2));
    expect(request.mock.calls.filter(([, options]) => options?.method === "PUT")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Upload privately" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Submit application" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));
    expect(await screen.findByRole("heading", { name: "Application submitted successfully" })).toBeInTheDocument();
    expect(screen.getByText(/Thank you — we have received/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit application" })).not.toBeInTheDocument();
  });
  it("retains confirmation on return to an already-submitted application", async () => {
    application.credentials = [credential("licence"), credential("registrationCertificate")]; application.submittedAt = "2026-10-05T22:45:00Z";
    mount(); expect(await screen.findByRole("heading", { name: "Application submitted successfully" })).toBeInTheDocument();
    expect(screen.getByText(/You do not need to upload them again/)).toBeInTheDocument();
  });
  it("never uploads invalid files or shows a false submission confirmation", async () => {
    mount(); await screen.findByText("Upload your credentials"); select("licence", "text/html");
    expect(screen.getByRole("alert")).toHaveTextContent(/PDF, JPG or PNG/);
    expect(request.mock.calls.some(([, options]) => options?.method === "PUT")).toBe(false);
    expect(screen.getByRole("button", { name: "Submit application" })).toBeDisabled();
  });
  it("keeps upload failures retriable without falsely marking the document uploaded", async () => {
    request.mockImplementation(async (_path, options) => { if (options?.method === "PUT") throw new Error("Storage unavailable"); return { data: application }; });
    mount(); await screen.findByText("Upload your credentials"); select("licence");
    expect(await screen.findByRole("button", { name: "Retry upload" })).toBeEnabled();
    expect(screen.queryByText("Document uploaded")).not.toBeInTheDocument(); expect(screen.getByRole("button", { name: "Submit application" })).toBeDisabled();
  });
});

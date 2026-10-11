import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RiderOnboarding from "./RiderOnboarding";
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  write: vi.fn(),
  api: vi.fn(),
  restore: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));
vi.mock("./riderApi", () => ({
  getLive: mocks.get,
  writeLive: mocks.write,
}));
vi.mock("@/identity/liveIdentity", () => ({
  liveApiRequest: mocks.api,
  restoreLiveIdentity: mocks.restore,
  liveSignIn: mocks.login,
  liveSignOut: mocks.logout,
}));
const requirements = [
  { kind: "drivingLicence", label: "Driving licence" },
  { kind: "vehicleRegistration", label: "Vehicle registration" },
  { kind: "insurance", label: "Vehicle insurance" },
];
const config = {
  enabled: true,
  consentVersion: "sabi-rider-onboarding-v1",
  maxUploadBytes: 3500000,
  requirements,
};
const application = {
  id: "synthetic-app",
  userId: "synthetic-rider",
  email: "rider@synthetic.test",
  fullName: "Synthetic Rider",
  phone: "123456789",
  city: "Ikeja",
  state: "Lagos",
  vehicleType: "MOTORCYCLE",
  licenceExpiresAt: "2099-01-01",
  insuranceExpiresAt: "2099-01-01",
  status: "DRAFT",
  version: 1,
  credentials: [],
  requirements,
  maxUploadBytes: 3500000,
  blockers: [],
};
const identity = {
  user: { id: "synthetic-rider", email: "rider@synthetic.test", roles: [] },
};
function mount(path = "/rider/application") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <RiderOnboarding />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.restore.mockResolvedValue(identity);
  mocks.get.mockImplementation(async (path) =>
    path.endsWith("/registration-config") ? config : application,
  );
  mocks.write.mockResolvedValue({});
  mocks.api.mockResolvedValue({});
});
describe("rider registration and automatic documents", () => {
  it("shows signup without granting access and respects disabled registration", async () => {
    mocks.get.mockResolvedValue({ ...config, enabled: false });
    mount("/rider/register");
    expect(
      await screen.findByRole("button", { name: "Create rider account" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/Registration is temporarily unavailable/),
    ).toBeInTheDocument();
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("automatically uploads the selected file with a deadline and no separate private upload button", async () => {
    mount();
    const input = await screen.findByLabelText("Driving licence document");
    fireEvent.change(input, {
      target: {
        files: [
          new File(["%PDF-test"], "synthetic.pdf", { type: "application/pdf" }),
        ],
      },
    });
    await waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(1));
    expect(mocks.api.mock.calls[0][0]).toBe(
      "/api/v1/riders/applications/synthetic-app/credentials/drivingLicence",
    );
    expect(mocks.api.mock.calls[0][1]).toMatchObject({
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
    });
    expect(mocks.api.mock.calls[0][1].signal).toBeDefined();
    expect(await screen.findByText(/Document received/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /upload privately/i }),
    ).not.toBeInTheDocument();
  });
  it("rejects unsupported and oversized files before upload", async () => {
    mount();
    const input = await screen.findByLabelText("Driving licence document");
    fireEvent.change(input, {
      target: {
        files: [
          new File(["x"], "bad.exe", { type: "application/octet-stream" }),
        ],
      },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose a PDF, PNG or JPEG",
    );
    expect(mocks.api).not.toHaveBeenCalled();
    const huge = new File([new Uint8Array(3500001)], "huge.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(input, { target: { files: [huge] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("up to");
    expect(mocks.api).not.toHaveBeenCalled();
  });
  it("confirms submission even while scanning is pending", async () => {
    const app = {
      ...application,
      credentials: requirements.map((r, i) => ({
        id: String(i),
        kind: r.kind,
        scanStatus: "PENDING",
        reviewStatus: "PENDING",
      })),
    };
    mocks.get.mockImplementation(async (path) =>
      path.endsWith("/registration-config") ? config : app,
    );
    mount();
    const button = await screen.findByRole("button", {
      name: "Submit application",
    });
    fireEvent.click(button);
    expect(
      await screen.findByText(/Application submitted successfully/),
    ).toHaveTextContent("synthetic-app");
    expect(mocks.write).toHaveBeenCalledWith(
      "/api/v1/riders/applications/synthetic-app/submit",
      { version: 1 },
    );
  });
  it("does not report success on a rejected submission", async () => {
    const app = {
      ...application,
      credentials: requirements.map((r, i) => ({
        id: String(i),
        kind: r.kind,
        scanStatus: "CLEAN",
        reviewStatus: "PENDING",
      })),
    };
    mocks.get.mockImplementation(async (path) =>
      path.endsWith("/registration-config") ? config : app,
    );
    mocks.write.mockRejectedValue(new Error("Application changed. Refresh."));
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "Submit application" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Application changed",
    );
    expect(
      screen.queryByText(/Application submitted successfully/),
    ).not.toBeInTheDocument();
  });
  it("requires an explicit email verification action, not a GET side effect", async () => {
    mount("/rider/verify-email/synthetic-user#abcdef");
    const button = await screen.findByRole("button", { name: "Verify email" });
    expect(mocks.write).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(
      await screen.findByRole("heading", { name: "Email verified" }),
    ).toBeInTheDocument();
    expect(mocks.write).toHaveBeenCalledWith("/api/v1/riders/verify-email", {
      uid: "synthetic-user",
      token: "abcdef",
    });
  });
  it("suspended applications cannot upload or self-activate", async () => {
    mocks.get.mockImplementation(async (path) =>
      path.endsWith("/registration-config")
        ? config
        : {
            ...application,
            status: "SUSPENDED",
            decisionReason: "Operations review",
          },
    );
    mount();
    expect(await screen.findByText("SUSPENDED")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Choose document/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Submit application" }),
    ).not.toBeInTheDocument();
  });
});

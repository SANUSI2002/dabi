import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RiderPortal from "./RiderPortal";
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  write: vi.fn(),
  restore: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));
vi.mock("@/pharmacy/liveApi", () => ({
  getLive: mocks.get,
  writeLive: mocks.write,
}));
vi.mock("@/identity/liveIdentity", () => ({
  restoreLiveIdentity: mocks.restore,
  liveSignIn: mocks.login,
  liveSignOut: mocks.logout,
}));
vi.mock("@/config/runtime", () => ({ apiConfigured: true }));
const identity = {
  user: {
    id: "rider",
    email: "rider@example.test",
    roles: ["DELIVERY_PARTNER"],
  },
};
const overview = {
  profile: {
    id: "partner",
    userId: "rider",
    displayName: "Sabi Rider",
    isActive: true,
  },
  stats: { pending: 2, active: 1, completed: 7 },
};
const assignment = {
  id: "delivery",
  reference: "SABI-ORDER-123",
  assignmentStatus: "ACCEPTED",
  fulfilmentStatus: "OUT_FOR_DELIVERY",
  pickup: {
    name: "Test pharmacy",
    address: "Test pickup",
    contactPhone: "123",
  },
  recipient: {
    recipientName: "Synthetic recipient",
    recipientPhone: "456",
    address: "Test destination",
  },
};
function mount(path = "/rider/dashboard") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <RiderPortal />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.restore.mockResolvedValue(identity);
  mocks.get.mockImplementation(async (path) =>
    path.endsWith("/me")
      ? overview
      : path.includes("/history?")
        ? { items: [], nextOffset: null }
        : path.endsWith("/assignments")
          ? [assignment]
          : assignment,
  );
});
describe("connected rider portal", () => {
  it("uses server counts and the uploaded sidebar structure without fabricated ratings or earnings", async () => {
    mount();
    expect(
      await screen.findByRole("heading", { name: "Hello, Sabi." }),
    ).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Rider navigation" }),
    ).toBeInTheDocument();
    expect(
      document.querySelector('nav[aria-label="Mobile rider navigation"]'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/4\.8|120k|2,400/)).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });
  it("blocks a standard account and never calls private rider endpoints", async () => {
    mocks.restore.mockResolvedValue({ user: { roles: ["PATIENT"] } });
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent(/must activate/);
    expect(mocks.get).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("navigation", { name: "Rider navigation" }),
    ).not.toBeInTheDocument();
  });
  it("does not display an activated workspace when the backend denies the profile", async () => {
    mocks.get.mockRejectedValue(new Error("Access denied"));
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent("Access denied");
    expect(screen.queryByText("Activated rider")).not.toBeInTheDocument();
  });
  it("requires delivery code and removes recipient details immediately after server confirmation", async () => {
    let delivered = false;
    mocks.write.mockImplementation(async () => {
      delivered = true;
      return { assignmentStatus: "COMPLETED", fulfilmentStatus: "DELIVERED" };
    });
    mocks.get.mockImplementation(async (path) =>
      path.endsWith("/me")
        ? overview
        : path.endsWith("/assignments")
          ? delivered
            ? []
            : [assignment]
          : delivered
            ? {
                ...assignment,
                recipient: undefined,
                assignmentStatus: "COMPLETED",
                fulfilmentStatus: "DELIVERED",
              }
            : assignment,
    );
    mount("/rider/delivery/delivery");
    const input = await screen.findByLabelText("Six-digit delivery code");
    expect(screen.getByText("Synthetic recipient")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "000456" } });
    fireEvent.submit(input.closest("form")!);
    expect(
      await screen.findByRole("heading", { name: "Delivered successfully." }),
    ).toBeInTheDocument();
    expect(mocks.write).toHaveBeenCalledWith(
      "/api/v1/delivery/assignments/delivery/status",
      { status: "DELIVERED", code: "000456" },
    );
    expect(screen.queryByText("Synthetic recipient")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Six-digit delivery code"),
    ).not.toBeInTheDocument();
  });
  it("retains confirmed delivery when the subsequent refresh fails", async () => {
    mocks.write.mockResolvedValue({
      assignmentStatus: "COMPLETED",
      fulfilmentStatus: "DELIVERED",
    });
    mount("/rider/delivery/delivery");
    const input = await screen.findByLabelText("Six-digit delivery code");
    mocks.get.mockRejectedValue(new Error("Offline"));
    fireEvent.change(input, { target: { value: "000456" } });
    fireEvent.submit(input.closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Handover saved.",
    );
    expect(
      screen.getByRole("heading", { name: "Delivered successfully." }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Synthetic recipient")).not.toBeInTheDocument();
  });
  it("loads and paginates actual history without recipient data", async () => {
    const completed = {
      ...assignment,
      assignmentStatus: "COMPLETED",
      fulfilmentStatus: "DELIVERED",
      recipient: undefined,
    };
    mocks.get.mockImplementation(async (path) =>
      path.endsWith("/me")
        ? overview
        : path.endsWith("/assignments")
          ? []
          : {
              items: [
                {
                  ...completed,
                  id: path.endsWith("offset=0") ? "one" : "two",
                  reference: path.endsWith("offset=0")
                    ? "HISTORY-ONE"
                    : "HISTORY-TWO",
                },
              ],
              nextOffset: path.endsWith("offset=0") ? 20 : null,
            },
    );
    mount("/rider/history");
    expect(await screen.findByText("HISTORY-ONE")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load more history" }));
    expect(await screen.findByText("HISTORY-TWO")).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith(
      "/api/v1/delivery/history?limit=20&offset=20",
    );
    expect(
      screen.queryByRole("button", { name: "Load more history" }),
    ).not.toBeInTheDocument();
  });
  it("preserves Sabi identity MFA sign-in instead of the ZIP's mock token storage", async () => {
    mocks.restore.mockResolvedValue(null);
    mocks.login.mockResolvedValue({ kind: "MFA" });
    mount("/rider/login");
    const email = await screen.findByLabelText("Email address");
    fireEvent.change(email, { target: { value: "rider@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "synthetic-test-value" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(mocks.login).toHaveBeenCalledWith(
        "rider@example.test",
        "synthetic-test-value",
      ),
    );
    expect(localStorage.getItem("sabi-rider-session")).toBeNull();
  });
  it("makes joining an honest operations contact instead of a fake registration success", async () => {
    mount("/rider/join");
    expect(
      screen.getByRole("link", { name: /Contact Sabi operations/ }),
    ).toHaveAttribute(
      "href",
      "mailto:support@sabihealth.org?subject=Sabi%20rider%20network%20enquiry",
    );
    expect(
      screen.queryByRole("button", { name: /submit|upload/i }),
    ).not.toBeInTheDocument();
    expect(mocks.write).not.toHaveBeenCalled();
  });
});

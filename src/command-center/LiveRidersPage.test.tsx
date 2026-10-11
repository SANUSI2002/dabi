import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LiveRidersPage from "./LiveRidersPage";
const mocks = vi.hoisted(() => ({ get: vi.fn(), write: vi.fn() }));
vi.mock("@/rider/riderApi", () => ({
  getLive: mocks.get,
  writeLive: mocks.write,
}));
const app = {
  id: "synthetic",
  userId: "rider",
  email: "synthetic@rider.test",
  fullName: "Synthetic Rider",
  phone: "12345",
  city: "Ikeja",
  state: "Lagos",
  vehicleType: "MOTORCYCLE",
  licenceExpiresAt: "2099-01-01",
  insuranceExpiresAt: "2099-01-01",
  status: "SUBMITTED",
  version: 8,
  credentials: [],
  blockers: [],
};
const doc = {
  id: "doc",
  kind: "insurance",
  scanStatus: "PENDING",
  reviewStatus: "PENDING",
  contentType: "application/pdf",
  byteSize: 100,
};
function mount(
  path = "/command-center/sabi-health/riders/synthetic",
  canApprove = true,
  userId = "reviewer",
) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LiveRidersPage canApprove={canApprove} userId={userId} />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockResolvedValue(app);
  mocks.write.mockResolvedValue({});
});
describe("rider operations", () => {
  it("renders the real queue with no fabricated applications", async () => {
    mocks.get.mockResolvedValue({ items: [], nextOffset: null });
    mount("/command-center/sabi-health/riders");
    expect(
      await screen.findByText("No applications in this queue."),
    ).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith(
      "/api/v1/platform/riders?status=SUBMITTED&offset=0",
    );
  });
  it("prevents preview and approval while security requirements are outstanding", async () => {
    mocks.get.mockResolvedValue({
      ...app,
      credentials: [doc],
      blockers: ["Insurance: clean screening required."],
    });
    mount();
    expect(
      await screen.findByRole("button", { name: "Approve rider" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Preview document" }),
    ).toBeDisabled();
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("cannot decide an own application", async () => {
    mount(undefined, true, "rider");
    await screen.findByText(app.email, { exact: false });
    expect(
      screen.queryByRole("button", { name: "Approve rider" }),
    ).not.toBeInTheDocument();
  });
  it("uses server version for approval and reports saved decisions", async () => {
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "Approve rider" }),
    );
    await waitFor(() =>
      expect(mocks.write).toHaveBeenCalledWith(
        "/api/v1/platform/riders/synthetic/approve",
        { version: 8 },
      ),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Action saved and audited",
    );
  });
  it("rejects an untrusted document URL instead of embedding it", async () => {
    mocks.get.mockImplementation(async (path) =>
      path.endsWith("/preview")
        ? { url: "https://evil.test/credential" }
        : { ...app, credentials: [{ ...doc, scanStatus: "CLEAN" }] },
    );
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "Preview document" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "private preview is not trusted",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

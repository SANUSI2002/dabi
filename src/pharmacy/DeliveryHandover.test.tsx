import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DeliveryHandover from "./DeliveryHandover";
import CourierPortal from "./CourierPortal";
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  write: vi.fn(),
  restore: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("./liveApi", () => ({ getLive: mocks.get, writeLive: mocks.write }));
vi.mock("@/identity/liveIdentity", () => ({
  restoreLiveIdentity: mocks.restore,
  liveSignIn: mocks.signIn,
  liveSignOut: mocks.signOut,
}));
vi.mock("@/config/runtime", () => ({ apiConfigured: true }));
const mount = (ui: React.ReactNode) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);
const assignment = {
  id: "assignment",
  reference: "SABI-ORDER-1",
  assignmentStatus: "ACCEPTED",
  fulfilmentStatus: "READY_FOR_PICKUP",
  pickup: {
    name: "Haven Pharmacy",
    address: "1 Test Road",
    contactPhone: "0123",
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.restore.mockResolvedValue({ user: { roles: ["DELIVERY_PARTNER"] } });
  mocks.write.mockResolvedValue({});
});
describe("pharmacy handover", () => {
  it("shows collection code only after acceptance and its physical handover instruction", async () => {
    mocks.get.mockResolvedValue({
      fulfilmentId: "f",
      fulfilmentStatus: "READY_FOR_PICKUP",
      assignment: { id: "a", status: "ACCEPTED", courierName: "Courier" },
      code: "012345",
    });
    mount(<DeliveryHandover fulfilmentId="f" status="READY_FOR_PICKUP" />);
    expect(
      await screen.findByLabelText("Collection code 0 1 2 3 4 5"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/only when handing over the package/),
    ).toBeInTheDocument();
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("assigns an existing configured courier and waits for acceptance", async () => {
    let assigned = false;
    mocks.get.mockImplementation(async (path) =>
      path.endsWith("/partners")
        ? [{ id: "p", displayName: "Courier" }]
        : {
            fulfilmentStatus: "READY_FOR_PICKUP",
            assignment: assigned
              ? { id: "a", status: "PENDING", courierName: "Courier" }
              : null,
            code: null,
          },
    );
    mocks.write.mockImplementation(async () => {
      assigned = true;
      return {};
    });
    mount(<DeliveryHandover fulfilmentId="f" status="READY_FOR_PICKUP" />);
    const select = await screen.findByLabelText("Delivery partner");
    await waitFor(() =>
      expect(
        screen.getByRole("option", { name: "Courier" }),
      ).toBeInTheDocument(),
    );
    fireEvent.change(select, { target: { value: "p" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign courier" }));
    expect(
      await screen.findByText(/Waiting for the courier to accept/),
    ).toBeInTheDocument();
    expect(mocks.write).toHaveBeenCalledWith(
      "/api/v1/delivery/fulfilments/f/assignment",
      { partnerId: "p" },
    );
    expect(screen.queryByText("Collection code")).not.toBeInTheDocument();
  });
  it("shows expired/error states without inventing a code or status", async () => {
    mocks.get.mockRejectedValue(new Error("Access denied"));
    mount(<DeliveryHandover fulfilmentId="f" status="READY_FOR_PICKUP" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Access denied");
    expect(screen.queryByText("Collection code")).not.toBeInTheDocument();
  });
});
describe("courier code entry", () => {
  async function select() {
    mount(<CourierPortal />);
    fireEvent.click(
      await screen.findByRole("button", { name: /SABI-ORDER-1/ }),
    );
    return screen.findByLabelText("Six-digit collection code");
  }
  it("submits pickup proof with leading zeros, then opens delivery proof only after starting delivery", async () => {
    let current = { ...assignment };
    mocks.get.mockImplementation(async (path) =>
      path.endsWith("/assignments")
        ? current.assignmentStatus === "COMPLETED"
          ? []
          : [current]
        : current,
    );
    mocks.write.mockImplementation(async (_path, body) => {
      current = {
        ...current,
        fulfilmentStatus: body.status,
        assignmentStatus:
          body.status === "DELIVERED" ? "COMPLETED" : "ACCEPTED",
      };
      return {};
    });
    const input = await select();
    expect(
      screen.getByRole("button", { name: "Verify package collected" }),
    ).toBeDisabled();
    fireEvent.change(input, { target: { value: "012345" } });
    fireEvent.submit(input.closest("form")!);
    expect(
      await screen.findByRole("button", { name: "Start delivery" }),
    ).toBeInTheDocument();
    expect(mocks.write).toHaveBeenCalledWith(
      "/api/v1/delivery/assignments/assignment/status",
      { status: "PICKED_UP", code: "012345" },
    );
    fireEvent.click(screen.getByRole("button", { name: "Start delivery" }));
    expect(await screen.findByLabelText("Six-digit delivery code")).toHaveValue(
      "",
    );
  });
  it("does not advance a rejected code and prevents duplicate submission while verifying", async () => {
    mocks.get.mockImplementation(async (path) =>
      path.endsWith("/assignments") ? [assignment] : assignment,
    );
    let reject: (e: Error) => void = () => {};
    mocks.write.mockReturnValue(
      new Promise((_resolve, r) => {
        reject = r;
      }),
    );
    const input = await select();
    fireEvent.change(input, { target: { value: "123456" } });
    fireEvent.submit(input.closest("form")!);
    expect(
      await screen.findByRole("button", { name: "Verifying…" }),
    ).toBeDisabled();
    reject(new Error("Incorrect handover code."));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Incorrect handover code.",
    );
    expect(
      screen.queryByRole("button", { name: "Start delivery" }),
    ).not.toBeInTheDocument();
  });
  it("renders empty assignments without demo deliveries or secrets", async () => {
    mocks.get.mockResolvedValue([]);
    mount(<CourierPortal />);
    expect(
      await screen.findByText(/No active assignments/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/Six-digit/)).not.toBeInTheDocument();
  });
});

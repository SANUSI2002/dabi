import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import LivePharmacyEntry from "./LivePharmacyEntry";
import InventoryControls from "./InventoryControls";
import LicenceRenewalForm from "./LicenceRenewalForm";
import type { LiveInventory, LivePharmacy } from "./liveApi";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  write: vi.fn(),
  restore: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("./liveApi", async (original) => ({
  ...(await original<typeof import("./liveApi")>()),
  getLive: mocks.get,
  writeLive: mocks.write,
}));
vi.mock("@/identity/liveIdentity", () => ({
  restoreLiveIdentity: mocks.restore,
  liveSignOut: mocks.signOut,
}));
vi.mock("./LivePharmacyPortal", () => ({
  default: () => <p>Owner workspace</p>,
}));
vi.mock("./PharmacistWorkspace", () => ({
  default: () => <p>Verified pharmacist workspace</p>,
}));
beforeEach(() => {
  mocks.restore.mockResolvedValue({ id: "user" });
  mocks.write.mockResolvedValue({});
});
const mount = (ui: React.ReactNode) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);
const item: LiveInventory = {
  id: "stock-1",
  branchId: "branch-1",
  medicationName: "Test essential",
  genericName: null,
  availableQuantity: 4,
  unitPriceMinor: 150050,
  isActive: true,
  currency: "NGN",
  batchNumber: null,
  expiryDate: null,
  listing: {
    id: "listing-1",
    inventoryItemId: "stock-1",
    category: "DEVICES",
    description: "Test product description",
    productClass: "NON_MEDICINAL",
    nafdacNumber: null,
    status: "PUBLISHED",
    imageHash: "test",
    version: 3,
    reviewNote: null,
  },
};
const perform = async (action: () => Promise<unknown>) => {
  await action();
};
describe("live pharmacy workspaces", () => {
  it("uses the server workspace, not local demo records", async () => {
    mocks.get.mockResolvedValue({
      items: [{ id: "a", name: "Approved pharmacy", kind: "OWNER" }],
      invitations: [],
    });
    mount(<LivePharmacyEntry />);
    expect(await screen.findByText("Owner workspace")).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith(
      "/api/v1/pharmacy-portal/workspaces",
    );
  });
  it("does not grant a workspace when an API request fails", async () => {
    mocks.get.mockRejectedValue(new Error("Membership access denied"));
    mount(<LivePharmacyEntry />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Membership access denied",
    );
    expect(screen.queryByText("Owner workspace")).not.toBeInTheDocument();
  });
  it("requires explicit acceptance before opening the pharmacist workspace", async () => {
    mocks.get
      .mockResolvedValueOnce({
        items: [],
        invitations: [{ id: "invite-1", pharmacy: { name: "Test pharmacy" } }],
      })
      .mockResolvedValueOnce({
        items: [{ id: "a", kind: "PHARMACIST", name: "Test pharmacy" }],
        invitations: [],
      });
    mount(<LivePharmacyEntry />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Accept pharmacy membership" }),
    );
    expect(
      await screen.findByText("Verified pharmacist workspace"),
    ).toBeInTheDocument();
    expect(mocks.write).toHaveBeenCalledWith(
      "/api/v1/pharmacy-portal/pharmacists/invite-1/accept",
      {},
    );
  });
  it("records stock changes with an idempotency key and expected server quantity", async () => {
    mount(<InventoryControls item={item} busy={false} perform={perform} />);
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Quantity change" }),
      { target: { value: "7" } },
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Reason" }), {
      target: { value: "Synthetic delivery received" },
    });
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Record stock change" })
        .closest("form")!,
    );
    await waitFor(() =>
      expect(mocks.write).toHaveBeenCalledWith(
        "/api/v1/pharmacy-portal/inventory/stock-1/adjust",
        expect.objectContaining({
          expectedQuantity: 4,
          quantityDelta: 7,
          idempotencyKey: expect.any(String),
        }),
      ),
    );
  });
  it("withdraws the exact reviewed listing revision", async () => {
    mount(<InventoryControls item={item} busy={false} perform={perform} />);
    fireEvent.click(screen.getByRole("button", { name: "Withdraw listing" }));
    expect(mocks.write).toHaveBeenCalledWith(
      "/api/v1/pharmacy-portal/listings/listing-1/withdraw",
      { version: 3 },
    );
  });
  it("discloses renewal reapproval and sends a versioned premises update", async () => {
    const branch = {
      id: "branch-1",
      name: "Test branch",
      address: "1 Test Road",
      latitude: 6.5,
      longitude: 3.3,
      premisesLicenceNumber: "TEST-PCN",
      licenceExpiresAt: "2027-12-31T00:00:00Z",
      status: "VERIFIED",
      version: 2,
    };
    mount(
      <LicenceRenewalForm
        pharmacy={{ registrationDetails: {} } as LivePharmacy}
        branch={branch}
        busy={false}
        perform={perform}
      />,
    );
    expect(
      screen.getByText(/Changes pause marketplace selling/),
    ).toBeInTheDocument();
    fireEvent.change(
      screen.getByRole("textbox", { name: "Reason for change" }),
      { target: { value: "Synthetic licence renewal" } },
    );
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Save renewal details" })
        .closest("form")!,
    );
    await waitFor(() =>
      expect(mocks.write).toHaveBeenCalledWith(
        "/api/v1/pharmacy-portal/branches/branch-1",
        expect.objectContaining({
          version: 2,
          premisesLicenceNumber: "TEST-PCN",
          reason: "Synthetic licence renewal",
        }),
        "PATCH",
      ),
    );
  });
});

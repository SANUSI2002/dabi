import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LiveMarketplace from "../../apps/telemedicine/packages/patient-portal/src/pages/pharmacy-market/LiveMarketplace.jsx";
const cart = vi.hoisted(() => ({
  addToCart: vi.fn(),
  findProduct: vi.fn(),
  getCartForPharmacy: vi.fn(),
  registerExtraPharmacy: vi.fn(),
  registerExtraProduct: vi.fn(),
}));
vi.mock(
  "../../apps/telemedicine/packages/patient-portal/src/pages/pharmacy-market/cartStore",
  () => cart,
);
vi.mock(
  "../../apps/telemedicine/packages/patient-portal/src/utils/sabiIdentity",
  () => ({ apiBaseUrl: "https://api.example.test" }),
);
vi.mock(
  "../../apps/telemedicine/packages/patient-portal/src/pages/dashboard/components",
  () => ({ Sidebar: () => null, Topbar: () => null }),
);
vi.mock(
  "../../apps/telemedicine/packages/patient-portal/src/hooks/useZoom",
  () => ({ useZoom: () => [1] }),
);
const row = {
  id: "listing-test",
  category: "DEVICES",
  productClass: "NON_MEDICINAL",
  description: "Test device",
  imageUrl: "/api/v1/marketplace/products/listing-test/image",
  inventoryItem: {
    medicationName: "Synthetic thermometer",
    genericName: null,
    availableQuantity: 3,
    unitPriceMinor: 250000,
    branch: {
      id: "branch-test",
      name: "Verified branch",
      address: "1 Test Road",
    },
    pharmacy: {
      id: "pharmacy-test",
      name: "Approved pharmacy",
      city: "Ikeja",
      state: "Lagos",
      tier: {
        level: 1,
        name: "Tier 1",
        deliveryRadiusKm: 5,
        pickupEnabled: true,
        deliveryEnabled: true,
      },
    },
  },
};
function mount() {
  render(
    <MemoryRouter>
      <LiveMarketplace />
    </MemoryRouter>,
  );
}
function respond(items) {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ data: { items, nextPage: null } }),
      }),
  );
}
beforeEach(() => {
  cart.getCartForPharmacy.mockReturnValue({});
});
afterEach(() => {
  vi.unstubAllGlobals();
});
describe("patient live pharmacy marketplace", () => {
  it("loads only the approved server catalogue and never fills an empty feed with fixtures", async () => {
    respond([]);
    mount();
    await waitFor(() =>
      expect(
        screen.queryByText("Loading approved products…"),
      ).not.toBeInTheDocument(),
    );
    expect(screen.queryByText("Synthetic thermometer")).not.toBeInTheDocument();
    expect(cart.addToCart).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/marketplace/products?page=1"),
      expect.objectContaining({ cache: "no-store" }),
    );
  });
  it("reports service failure and offers a retry instead of fake products", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: false,
          json: async () => ({ message: "Catalogue temporarily unavailable" }),
        }),
    );
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Catalogue temporarily unavailable",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });
  it("adds the actual listing and branch with its required product image", async () => {
    respond([row]);
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: /Add .* to cart/i }),
    );
    expect(cart.registerExtraProduct).toHaveBeenCalledWith(
      "pharmacy-test",
      expect.objectContaining({
        id: "listing-test",
        listingId: "listing-test",
        branchId: "branch-test",
        source: "marketplace",
        photo:
          "https://api.example.test/api/v1/marketplace/products/listing-test/image",
      }),
    );
    expect(cart.addToCart).toHaveBeenCalledWith(
      "pharmacy-test",
      "listing-test",
      1,
    );
  });
  it("prevents mixing two branches of one pharmacy in the cart", async () => {
    cart.getCartForPharmacy.mockReturnValue({ other: 1 });
    cart.findProduct.mockReturnValue({
      source: "marketplace",
      branchId: "different-branch",
    });
    respond([row]);
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: /Add .* to cart/i }),
    );
    expect(cart.addToCart).not.toHaveBeenCalled();
    expect(
      screen.getByText(/already contains products from another branch/),
    ).toBeInTheDocument();
  });
  it("does not add beyond displayed available stock", async () => {
    cart.getCartForPharmacy.mockReturnValue({ "listing-test": 3 });
    cart.findProduct.mockReturnValue({
      source: "marketplace",
      branchId: "branch-test",
    });
    respond([row]);
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: /Add .* to cart/i }),
    );
    expect(cart.addToCart).not.toHaveBeenCalled();
    expect(
      screen.getByText(/reached the currently available quantity/),
    ).toBeInTheDocument();
  });
});

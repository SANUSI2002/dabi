import { afterEach, describe, expect, it } from "vitest";
import { buildMarketplaceProjection, getPharmacyOffers, getPublishedMarketplaceOffers, usePharmacyCatalogue } from "./catalogue";

describe("pharmacy catalogue tenant boundaries", () => {
  afterEach(() => {
    usePharmacyCatalogue.setState({ offers: [], configs: [], movements: [], profiles: [] });
  });

  it("keeps offers scoped to the pharmacy organization", () => {
    usePharmacyCatalogue.setState({ offers: [], configs: [] });
    usePharmacyCatalogue.getState().addOffer({ organizationId: "org-alpha", branchId: "branch-org-alpha-1", masterDrugId: "d1", sku: "A-1", packSize: "10 tablets", priceMinor: 1000, currency: "NGN", stockQuantity: 10, stockStatus: "IN_STOCK", prescriptionRequired: false, marketplaceStatus: "PUBLISHED", pickupEnabled: true, deliveryEnabled: true });
    usePharmacyCatalogue.getState().addOffer({ organizationId: "org-beta", branchId: "branch-org-beta-1", masterDrugId: "d2", sku: "B-1", packSize: "20 tablets", priceMinor: 2000, currency: "NGN", stockQuantity: 20, stockStatus: "IN_STOCK", prescriptionRequired: false, marketplaceStatus: "DRAFT", pickupEnabled: true, deliveryEnabled: false });

    expect(getPharmacyOffers("org-alpha").map((offer) => offer.organizationId)).toEqual(["org-alpha"]);
    expect(getPharmacyOffers("org-beta").map((offer) => offer.organizationId)).toEqual(["org-beta"]);
    expect(getPublishedMarketplaceOffers().map((offer) => offer.organizationId)).toEqual(["org-alpha"]);
  });

  it("exports only published offers from a publicly listed tenant", () => {
    usePharmacyCatalogue.setState({
      offers: [
        { id: "public", organizationId: "org-alpha", branchId: "branch-a", masterDrugId: "d2", sku: "A-PUBLIC", packSize: "20 tablets", priceMinor: 1500, currency: "NGN", stockQuantity: 20, stockStatus: "IN_STOCK", prescriptionRequired: false, marketplaceStatus: "PUBLISHED", pickupEnabled: true, deliveryEnabled: true, updatedAt: new Date().toISOString() },
        { id: "draft", organizationId: "org-alpha", branchId: "branch-a", masterDrugId: "d3", sku: "A-DRAFT", packSize: "20 capsules", priceMinor: 2500, currency: "NGN", stockQuantity: 10, stockStatus: "IN_STOCK", prescriptionRequired: true, marketplaceStatus: "DRAFT", pickupEnabled: true, deliveryEnabled: true, updatedAt: new Date().toISOString() },
        { id: "other", organizationId: "org-beta", branchId: "branch-b", masterDrugId: "d1", sku: "B-PUBLIC", packSize: "6 tablets", priceMinor: 3500, currency: "NGN", stockQuantity: 12, stockStatus: "IN_STOCK", prescriptionRequired: true, marketplaceStatus: "PUBLISHED", pickupEnabled: true, deliveryEnabled: false, updatedAt: new Date().toISOString() },
      ],
      configs: [
        { organizationId: "org-alpha", storefrontName: "Alpha Pharmacy", publicListingEnabled: true, showPrices: true, pickupEnabled: true, deliveryEnabled: true, orderLeadTimeMinutes: 30 },
        { organizationId: "org-beta", storefrontName: "Beta Pharmacy", publicListingEnabled: true, showPrices: true, pickupEnabled: true, deliveryEnabled: false, orderLeadTimeMinutes: 30 },
      ],
    });

    expect(buildMarketplaceProjection("org-alpha").offers.map((offer) => offer.id)).toEqual(["public"]);
  });

  it("records tenant-scoped stock movements and prevents negative inventory", () => {
    usePharmacyCatalogue.setState({ offers: [], configs: [], movements: [], profiles: [] });
    const offer = usePharmacyCatalogue.getState().addOffer({ organizationId: "org-alpha", branchId: "branch-a", masterDrugId: "d2", sku: "A-STOCK", packSize: "20 tablets", priceMinor: 1500, currency: "NGN", stockQuantity: 5, stockStatus: "LOW_STOCK", prescriptionRequired: false, marketplaceStatus: "DRAFT", pickupEnabled: true, deliveryEnabled: true, reorderLevel: 4 });

    const receipt = usePharmacyCatalogue.getState().recordStockMovement({ organizationId: "org-alpha", branchId: "branch-a", offerId: offer.id, type: "RECEIPT", quantity: 10, reference: "PO-001" });
    const rejected = usePharmacyCatalogue.getState().recordStockMovement({ organizationId: "org-alpha", branchId: "branch-a", offerId: offer.id, type: "SALE", quantity: 99, reference: "ORDER-001" });

    expect(receipt.error).toBeUndefined();
    expect(rejected.error).toContain("cannot exceed");
    expect(usePharmacyCatalogue.getState().offers.find((item) => item.id === offer.id)?.stockQuantity).toBe(15);
    expect(usePharmacyCatalogue.getState().movements.filter((movement) => movement.organizationId === "org-alpha")).toHaveLength(2);
  });
});

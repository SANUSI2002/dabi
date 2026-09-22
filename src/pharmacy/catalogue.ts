import { create } from "zustand";
import { drugs } from "@/data/mock";
import { developmentFixturesEnabled } from "@/config/runtime";
import { persisted } from "@/platform/persist";

export type PharmacyPublicationStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "PAUSED" | "REJECTED";
export type PharmacyStockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "UNAVAILABLE";

export type PharmacyMasterDrug = {
  id: string;
  name: string;
  strength: string;
  form: string;
  category: string;
  prescriptionRequired: boolean;
};

export type PharmacyOffer = {
  id: string;
  organizationId: string;
  branchId: string;
  masterDrugId: string;
  sku: string;
  packSize: string;
  priceMinor: number;
  currency: "NGN";
  stockQuantity: number | null;
  stockStatus: PharmacyStockStatus;
  prescriptionRequired: boolean;
  marketplaceStatus: PharmacyPublicationStatus;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  batchNumber?: string;
  expiryDate?: string;
  costPriceMinor?: number;
  reorderLevel?: number;
  updatedAt: string;
};

export type PharmacyStockMovementType = "OPENING_STOCK" | "RECEIPT" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "SALE" | "RETURN";

export type PharmacyStockMovement = {
  id: string;
  organizationId: string;
  branchId: string;
  offerId: string;
  type: PharmacyStockMovementType;
  quantity: number;
  balanceAfter: number;
  reference: string;
  notes?: string;
  occurredAt: string;
};

export type PharmacyMarketplaceConfig = {
  organizationId: string;
  storefrontName: string;
  publicListingEnabled: boolean;
  showPrices: boolean;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  orderLeadTimeMinutes: number;
  description?: string;
  address?: string;
  phone?: string;
  weekdayHours?: string;
  weekendHours?: string;
  deliveryFeeMinor?: number;
  minimumOrderMinor?: number;
};

export type PharmacyProfile = {
  organizationId: string;
  legalName: string;
  licenceNumber: string;
  superintendentPharmacist: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  defaultReorderLevel: number;
  receiptFooter: string;
};

export const MASTER_DRUGS: PharmacyMasterDrug[] = drugs.map((drug) => ({
  id: drug.id,
  name: drug.name,
  strength: drug.strength,
  form: drug.form,
  category: drug.klass,
  prescriptionRequired: ["Amoxicillin", "Amlodipine", "Metformin", "DMPA"].some((name) => drug.name.includes(name)),
}));

const now = () => new Date().toISOString();
const MARKETPLACE_PROJECTION_KEY = "sabi-pharmacy-marketplace:published:v1";
const initialOffers = (organizationId: string): PharmacyOffer[] => developmentFixturesEnabled && organizationId === "org-haven"
  ? [
      { id: "offer-haven-amox", organizationId, branchId: "branch-org-haven-1", masterDrugId: "d3", sku: "HVN-AMOX-500-20", packSize: "20 capsules", priceMinor: 4200, currency: "NGN", stockQuantity: 36, stockStatus: "LOW_STOCK", prescriptionRequired: true, marketplaceStatus: "DRAFT", pickupEnabled: true, deliveryEnabled: true, updatedAt: now() },
      { id: "offer-haven-para", organizationId, branchId: "branch-org-haven-1", masterDrugId: "d2", sku: "HVN-PARA-500-20", packSize: "20 tablets", priceMinor: 1800, currency: "NGN", stockQuantity: 120, stockStatus: "IN_STOCK", prescriptionRequired: false, marketplaceStatus: "PUBLISHED", pickupEnabled: true, deliveryEnabled: true, updatedAt: now() },
    ]
  : [];

type CatalogueState = {
  offers: PharmacyOffer[];
  configs: PharmacyMarketplaceConfig[];
  movements: PharmacyStockMovement[];
  profiles: PharmacyProfile[];
  addOffer: (offer: Omit<PharmacyOffer, "id" | "updatedAt">) => PharmacyOffer;
  updateOffer: (offerId: string, organizationId: string, patch: Partial<PharmacyOffer>) => void;
  recordStockMovement: (input: Omit<PharmacyStockMovement, "id" | "balanceAfter" | "occurredAt">) => { movement?: PharmacyStockMovement; error?: string };
  setPublicationStatus: (offerId: string, organizationId: string, status: PharmacyPublicationStatus) => void;
  setConfig: (config: PharmacyMarketplaceConfig) => void;
  setProfile: (profile: PharmacyProfile) => void;
};

export function buildMarketplaceProjection(organizationId?: string, state: Pick<CatalogueState, "offers" | "configs"> = usePharmacyCatalogue.getState()) {
  const publicOffers = state.offers.filter((offer) => offer.marketplaceStatus === "PUBLISHED" && (!organizationId || offer.organizationId === organizationId)).map((offer) => ({
      ...offer,
      drug: masterDrug(offer.masterDrugId),
      storefrontName: state.configs.find((config) => config.organizationId === offer.organizationId)?.storefrontName,
      publicListingEnabled: state.configs.find((config) => config.organizationId === offer.organizationId)?.publicListingEnabled ?? false,
      storefront: state.configs.find((config) => config.organizationId === offer.organizationId),
    })).filter((offer) => offer.publicListingEnabled);
  return { version: 1, generatedAt: now(), offers: publicOffers };
}

function syncMarketplaceProjection(state: Pick<CatalogueState, "offers" | "configs">) {
  if (!developmentFixturesEnabled) return;
  try {
    localStorage.setItem(MARKETPLACE_PROJECTION_KEY, JSON.stringify(buildMarketplaceProjection(undefined, state)));
  } catch {
    /* local development bridge is optional; the API remains authoritative */
  }
}

const scopedOffers = (offers: PharmacyOffer[], organizationId: string) => offers.filter((offer) => offer.organizationId === organizationId);

export const usePharmacyCatalogue = create<CatalogueState>(persisted<CatalogueState>("pharmacy-catalogue", (set, get) => ({
  offers: initialOffers("org-haven"),
  configs: developmentFixturesEnabled ? [{ organizationId: "org-haven", storefrontName: "Haven Pharmacy Network", publicListingEnabled: true, showPrices: true, pickupEnabled: true, deliveryEnabled: true, orderLeadTimeMinutes: 45, description: "Trusted medicines, pharmacist support and convenient fulfilment.", address: "12 Admiralty Way, Lekki, Lagos", phone: "+234 800 000 0000", weekdayHours: "08:00 AM - 09:00 PM", weekendHours: "09:00 AM - 07:00 PM", deliveryFeeMinor: 1500, minimumOrderMinor: 3000 }] : [],
  movements: [],
  profiles: developmentFixturesEnabled ? [{ organizationId: "org-haven", legalName: "Haven Pharmacy Network", licenceNumber: "PCN-PHA-2026-001", superintendentPharmacist: "Pharmacy Superintendent", email: "admin@haven-pharmacy.health", phone: "+234 800 000 0000", address: "12 Admiralty Way", city: "Lekki", state: "Lagos", defaultReorderLevel: 10, receiptFooter: "Thank you for choosing Haven Pharmacy." }] : [],
  addOffer: (input) => {
    const offer: PharmacyOffer = { ...input, id: `offer-${Date.now().toString(36)}`, updatedAt: now() };
    set((state) => {
      const openingQuantity = Math.max(0, offer.stockQuantity ?? 0);
      const movement: PharmacyStockMovement | undefined = openingQuantity > 0 ? { id: `move-${Date.now().toString(36)}`, organizationId: offer.organizationId, branchId: offer.branchId, offerId: offer.id, type: "OPENING_STOCK", quantity: openingQuantity, balanceAfter: openingQuantity, reference: "Opening balance", occurredAt: now() } : undefined;
      const next = { ...state, offers: [...state.offers, offer], movements: movement ? [...(state.movements ?? []), movement] : (state.movements ?? []) };
      syncMarketplaceProjection(next);
      return next;
    });
    return offer;
  },
  updateOffer: (offerId, organizationId, patch) => set((state) => { const next = { ...state, offers: state.offers.map((offer) => offer.id === offerId && offer.organizationId === organizationId ? { ...offer, ...patch, organizationId, updatedAt: now() } : offer) }; syncMarketplaceProjection(next); return next; }),
  recordStockMovement: (input) => {
    const state = get();
    const offer = state.offers.find((item) => item.id === input.offerId && item.organizationId === input.organizationId);
    if (!offer) return { error: "Inventory item was not found for this pharmacy." };
    const quantity = Math.abs(Math.trunc(input.quantity));
    if (!quantity) return { error: "Enter a quantity greater than zero." };
    const outgoing = input.type === "ADJUSTMENT_OUT" || input.type === "SALE";
    const balanceAfter = Math.max(0, (offer.stockQuantity ?? 0) + (outgoing ? -quantity : quantity));
    if (outgoing && quantity > (offer.stockQuantity ?? 0)) return { error: "The quantity cannot exceed available stock." };
    const threshold = offer.reorderLevel ?? 10;
    const movement: PharmacyStockMovement = { ...input, quantity: outgoing ? -quantity : quantity, balanceAfter, id: `move-${Date.now().toString(36)}`, occurredAt: now() };
    set((current) => {
      const next = { ...current, offers: current.offers.map((item) => item.id === offer.id && item.organizationId === input.organizationId ? { ...item, stockQuantity: balanceAfter, stockStatus: balanceAfter === 0 ? "OUT_OF_STOCK" as const : balanceAfter <= threshold ? "LOW_STOCK" as const : "IN_STOCK" as const, updatedAt: now() } : item), movements: [...(current.movements ?? []), movement] };
      syncMarketplaceProjection(next);
      return next;
    });
    return { movement };
  },
  setPublicationStatus: (offerId, organizationId, marketplaceStatus) => set((state) => { const next = { ...state, offers: state.offers.map((offer) => offer.id === offerId && offer.organizationId === organizationId ? { ...offer, marketplaceStatus, updatedAt: now() } : offer) }; syncMarketplaceProjection(next); return next; }),
  setConfig: (config) => set((state) => { const next = { ...state, configs: [...state.configs.filter((item) => item.organizationId !== config.organizationId), config] }; syncMarketplaceProjection(next); return next; }),
  setProfile: (profile) => set((state) => ({ ...state, profiles: [...(state.profiles ?? []).filter((item) => item.organizationId !== profile.organizationId), profile] })),
})));

if (developmentFixturesEnabled) syncMarketplaceProjection(usePharmacyCatalogue.getState());

export function getPharmacyOffers(organizationId: string) {
  return scopedOffers(usePharmacyCatalogue.getState().offers, organizationId);
}

export function getPublishedMarketplaceOffers(organizationId?: string) {
  return usePharmacyCatalogue.getState().offers.filter((offer) => offer.marketplaceStatus === "PUBLISHED" && (!organizationId || offer.organizationId === organizationId));
}

export function masterDrug(masterDrugId: string) {
  return MASTER_DRUGS.find((drug) => drug.id === masterDrugId);
}

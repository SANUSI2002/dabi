import { apiClient } from "@/api/client";
import type { PharmacyMasterDrug, PharmacyMarketplaceConfig, PharmacyOffer, PharmacyProfile, PharmacyPublicationStatus, PharmacyStockMovement } from "./catalogue";
import type { FulfilmentStatus, PharmacyOrder, PharmacyQuote, PharmacyRequest, QuoteLine } from "./workflow";

export type PharmacyCatalogueResponse = { masterDrugs: PharmacyMasterDrug[]; offers: PharmacyOffer[]; nextCursor?: string; dataAvailable: boolean };

/**
 * Server boundary for the operator portal. The UI uses the development store
 * until VITE_API_BASE_URL is configured; these methods are the only place that
 * should be swapped when the backend archive exposes its canonical routes.
 */
export const pharmacyApi = {
  listPrescriptionRequests: (params: { branchId?: string; status?: string; cursor?: string } = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value) as string[][]).toString();
    return apiClient.get<{ requests: PharmacyRequest[]; nextCursor?: string }>(`/api/v1/pharmacy/prescription-requests${query ? `?${query}` : ""}`, { authenticated: true });
  },
  startPrescriptionReview: (requestId: string, version: string) => apiClient.post<PharmacyRequest>(`/api/v1/pharmacy/prescription-requests/${requestId}/review`, {}, { authenticated: true, headers: { "If-Match": version } }),
  createQuote: (requestId: string, input: { items: QuoteLine[]; deliveryFeeMinor: number; expiresAt: string }, idempotencyKey: string) => apiClient.post<PharmacyQuote>(`/api/v1/pharmacy/prescription-requests/${requestId}/quotes`, input, { authenticated: true, headers: { "Idempotency-Key": idempotencyKey } }),
  sendQuote: (quoteId: string, version: string) => apiClient.post<PharmacyQuote>(`/api/v1/pharmacy/quotes/${quoteId}/send`, {}, { authenticated: true, headers: { "If-Match": version } }),
  listOrders: (params: { branchId?: string; status?: string; cursor?: string } = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value) as string[][]).toString();
    return apiClient.get<{ orders: PharmacyOrder[]; nextCursor?: string }>(`/api/v1/pharmacy/orders${query ? `?${query}` : ""}`, { authenticated: true });
  },
  advanceOrder: (orderId: string, input: { status: FulfilmentStatus; version: string }, idempotencyKey: string) => apiClient.post<PharmacyOrder>(`/api/v1/pharmacy/orders/${orderId}/transitions`, { status: input.status }, { authenticated: true, headers: { "If-Match": input.version, "Idempotency-Key": idempotencyKey } }),
  dispenseOrder: (orderId: string, input: { allocations: { orderLineId: string; offerId: string; batchNumber?: string; quantity: number }[]; version: string }, idempotencyKey: string) => apiClient.post<PharmacyOrder>(`/api/v1/pharmacy/orders/${orderId}/dispense`, { allocations: input.allocations }, { authenticated: true, headers: { "If-Match": input.version, "Idempotency-Key": idempotencyKey } }),
  listCatalogue: (params: { branchId?: string; search?: string; cursor?: string } = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value) as string[][]).toString();
    return apiClient.get<PharmacyCatalogueResponse>(`/api/v1/pharmacy/catalogue${query ? `?${query}` : ""}`, { authenticated: true });
  },
  createOffer: (input: Omit<PharmacyOffer, "id" | "updatedAt">, idempotencyKey: string) => apiClient.post<PharmacyOffer>("/api/v1/pharmacy/offers", input, { authenticated: true, headers: { "Idempotency-Key": idempotencyKey } }),
  updateOffer: (offerId: string, patch: Partial<PharmacyOffer>, version: string) => apiClient.patch<PharmacyOffer>(`/api/v1/pharmacy/offers/${offerId}`, patch, { authenticated: true, headers: { "If-Match": version } }),
  listStockMovements: (params: { branchId?: string; offerId?: string; cursor?: string } = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value) as string[][]).toString();
    return apiClient.get<{ movements: PharmacyStockMovement[]; nextCursor?: string }>(`/api/v1/pharmacy/inventory/movements${query ? `?${query}` : ""}`, { authenticated: true });
  },
  recordStockMovement: (input: Omit<PharmacyStockMovement, "id" | "balanceAfter" | "occurredAt">, idempotencyKey: string) => apiClient.post<PharmacyStockMovement>("/api/v1/pharmacy/inventory/movements", input, { authenticated: true, headers: { "Idempotency-Key": idempotencyKey } }),
  setPublication: (offerId: string, status: PharmacyPublicationStatus, idempotencyKey: string) => apiClient.post<PharmacyOffer>(`/api/v1/pharmacy/offers/${offerId}/publication`, { status }, { authenticated: true, headers: { "Idempotency-Key": idempotencyKey } }),
  getProfile: () => apiClient.get<PharmacyProfile>("/api/v1/pharmacy/settings/profile", { authenticated: true }),
  updateProfile: (profile: PharmacyProfile, version: string) => apiClient.patch<PharmacyProfile>("/api/v1/pharmacy/settings/profile", profile, { authenticated: true, headers: { "If-Match": version } }),
  getMarketplaceConfig: () => apiClient.get<PharmacyMarketplaceConfig>("/api/v1/pharmacy/marketplace/config", { authenticated: true }),
  updateMarketplaceConfig: (config: PharmacyMarketplaceConfig, version: string) => apiClient.patch<PharmacyMarketplaceConfig>("/api/v1/pharmacy/marketplace/config", config, { authenticated: true, headers: { "If-Match": version } }),
};

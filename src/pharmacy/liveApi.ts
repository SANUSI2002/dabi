import { liveApiRequest } from "@/identity/liveIdentity";
import type { LiveIdentity } from "@/identity/liveIdentity";
export const canEnterLivePharmacy = (identity: LiveIdentity | null) =>
  identity?.organizations.some(
    (m) =>
      m.organization.type === "PHARMACY" &&
      (m.status === "ACTIVE" ||
        (m.status === "PENDING" && m.roles.includes("PHARMACIST"))),
  );
export type PharmacyTier = {
  level: number;
  name: string;
  commissionBps: number;
  deliveryRadiusKm: number;
  maxBranches: number | null;
  minimumOrderMinor: number;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  enabled: boolean;
  version: number;
};
export type PharmacyBranch = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  premisesLicenceNumber: string;
  licenceExpiresAt: string;
  status: string;
  version: number;
};
export type PharmacyCredential = {
  id: string;
  kind: string;
  branchId: string | null;
  byteSize: number;
  scanStatus: string;
  reviewStatus: string;
  scanErrorCode: string | null;
  createdAt: string;
};
export type LivePharmacy = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  contactEmail: string;
  contactPhone: string;
  complianceStatus: string;
  decisionNote: string | null;
  tier: PharmacyTier | null;
  branches: PharmacyBranch[];
  credentials: PharmacyCredential[];
  blockers: string[];
  applicationSubmittedAt: string | null;
  registrationDetails: {
    superintendentName: string;
    superintendentRegistrationNumber: string;
    superintendentLicenceExpiresAt: string;
    cacNumber: string;
  };
};
export type LiveListing = {
  id: string;
  inventoryItemId: string;
  category: string;
  description: string;
  productClass: string;
  nafdacNumber: string | null;
  status: string;
  imageHash: string | null;
  version: number;
  reviewNote: string | null;
  inventoryItem?: {
    medicationName: string;
    unitPriceMinor: number;
    pharmacy: { id: string; name: string };
  };
};
export type LiveInventory = {
  id: string;
  branchId: string | null;
  medicationName: string;
  genericName: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  availableQuantity: number;
  unitPriceMinor: number;
  currency: string;
  isActive: boolean;
  listing: LiveListing | null;
};
export const getLive = <T>(path: string) =>
  liveApiRequest<{ data: T }>(path).then((r) => r.data);
export const writeLive = <T>(path: string, body: unknown, method = "POST") =>
  liveApiRequest<{ data: T }>(path, {
    method,
    body: JSON.stringify(body),
  }).then((r) => r.data);
export const uploadLive = <T>(path: string, file: File) =>
  liveApiRequest<{ data: T }>(path, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  }).then((r) => r.data);
export const money = (minor: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(minor / 100);
export function latestPharmacyCredentials(rows: PharmacyCredential[]) {
  const seen = new Set<string>();
  return [...rows]
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
    )
    .filter((row) => {
      const key = `${row.branchId || ""}:${row.kind}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

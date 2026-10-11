export type RiderCredential = {
  id: string;
  kind: string;
  contentType: string;
  byteSize: number;
  scanStatus: string;
  reviewStatus: string;
  scanErrorCode?: string | null;
  sourceName?: string;
  reference?: string;
  note?: string;
};
export type RiderApplication = {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  phone: string;
  state: string;
  city: string;
  vehicleType: string;
  licenceExpiresAt: string;
  insuranceExpiresAt: string;
  status: string;
  version: number;
  submittedAt: string | null;
  decisionReason: string | null;
  credentials: RiderCredential[];
  blockers: string[];
  requirements: { kind: string; label: string }[];
  maxUploadBytes: number;
};
export type RiderRegistrationConfig = {
  enabled: boolean;
  consentVersion: string;
  maxUploadBytes: number;
  requirements: { kind: string; label: string }[];
};
export const riderCredentialLabel = (kind: string) =>
  ({
    drivingLicence: "Driving licence",
    vehicleRegistration: "Vehicle registration",
    insurance: "Vehicle insurance",
  })[kind] || kind;

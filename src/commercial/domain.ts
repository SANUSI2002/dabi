import type { BillingCycle, Currency } from "@/command-center/domain";
import type { ProductKey } from "@/platform/entitlements";

export type CommercialStatus = "DRAFT" | "QUOTED" | "ACCEPTED" | "PAYMENT_PENDING" | "ACTIVE" | "CANCELLED";
export type QuoteStatus = "ISSUED" | "ACCEPTED" | "EXPIRED" | "SUPERSEDED";
export type PaymentPath = "TRIAL" | "INVOICE" | "MANUAL_TRANSFER";
export type PaymentStatus = "NOT_STARTED" | "PENDING" | "CONFIRMED" | "WAIVED" | "FAILED";

export type QuoteLineItem = {
  id: string;
  label: string;
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
};

export type CommercialQuote = {
  id: string;
  number: string;
  version: number;
  status: QuoteStatus;
  currency: Currency;
  lineItems: QuoteLineItem[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
  issuedAt: string;
  expiresAt: string;
  issuedBy: string;
  acceptedAt?: string;
  acceptedByName?: string;
};

export type CommercialAuditEvent = {
  id: string;
  action: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  timestamp: string;
  reason?: string;
  previousValue?: string;
  newValue?: string;
};

export type CommercialOpportunity = {
  id: string;
  applicationId: string;
  status: CommercialStatus;
  selectedProducts: ProductKey[];
  packageId: string;
  packageVersionId: string;
  billingCycle: Extract<BillingCycle, "Monthly" | "Annual">;
  branchCount: number;
  userCount: number;
  storageGb: number;
  implementationAmount: number;
  quotes: CommercialQuote[];
  paymentPath?: PaymentPath;
  paymentStatus: PaymentStatus;
  paymentReference?: string;
  paymentConfirmedAt?: string;
  activatedAt?: string;
  events: CommercialAuditEvent[];
  createdAt: string;
  updatedAt: string;
};

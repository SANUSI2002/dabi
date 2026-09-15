export type CurrencyCode = "NGN" | "USD" | "GBP" | "EUR" | (string & {});

export type FinancialStatus =
  | "OPEN"
  | "ACCUMULATING_CHARGES"
  | "READY_TO_BILL"
  | "PARTIALLY_INVOICED"
  | "INVOICED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "CREDIT_BALANCE"
  | "ON_HOLD"
  | "WRITTEN_OFF"
  | "FINANCIALLY_CLOSED";

export type ChargeSourceType =
  | "CONSULTATION"
  | "LABORATORY"
  | "PHARMACY"
  | "RADIOLOGY"
  | "PROCEDURE"
  | "WARD"
  | "NURSING"
  | "CONSUMABLE"
  | "MIGRATION"
  | "OTHER";

export type ChargeStatus = "BILLABLE" | "HELD" | "INVOICED" | "PAID" | "VOIDED" | "REVERSED" | "ENTERED_IN_ERROR";
export type InvoiceStatus = "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED" | "VOIDED" | "CREDITED";
export type PaymentStatus = "SUCCEEDED" | "REVERSED" | "VOIDED" | "REFUNDED";
export type PaymentMethod = "CASH" | "CARD_POS" | "BANK_TRANSFER" | "MOBILE_MONEY" | "INSURANCE" | "OTHER";

/** All values are integer minor units (kobo for NGN). */
export type Money = { amountMinor: number; currency: CurrencyCode };

export type PatientAccount = {
  id: string;
  number: string;
  organizationId: string;
  branchId: string;
  patientId: string;
  encounterId: string;
  appointmentId?: string;
  visitType: string;
  attendingProvider?: string;
  payer: string;
  currency: CurrencyCode;
  financialStatus: FinancialStatus;
  /** Human-readable blockers explaining why the encounter is not ready to bill. */
  readinessReasons: string[];
  openedAt: string;
  updatedAt: string;
};

export type ServiceCatalogItem = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  aliases?: string[];
  department: string;
  category: string;
  revenueAccountCode: string;
  active: boolean;
};

export type PriceVersion = {
  id: string;
  serviceId: string;
  priceListId: string;
  payerType: string;
  amountMinor: number;
  currency: CurrencyCode;
  effectiveFrom: string;
  effectiveUntil?: string;
  active: boolean;
};

export type ChargeItem = {
  id: string;
  organizationId: string;
  branchId: string;
  patientId: string;
  encounterId: string;
  accountId: string;
  sourceType: ChargeSourceType;
  sourceId: string;
  sourceEventId: string;
  idempotencyKey: string;
  serviceId: string;
  serviceCode: string;
  description: string;
  department: string;
  quantity: number;
  unitPriceMinor: number;
  grossAmountMinor: number;
  discountAmountMinor: number;
  netAmountMinor: number;
  currency: CurrencyCode;
  status: ChargeStatus;
  performedBy: string;
  performedAt: string;
  priceListId: string;
  priceVersionId: string;
  invoiceId?: string;
  correlationId: string;
  createdAt: string;
  createdBy: string;
};

export type RevenueInvoiceLine = {
  id: string;
  chargeItemId: string;
  serviceCode: string;
  description: string;
  department: string;
  quantity: number;
  unitPriceMinor: number;
  grossAmountMinor: number;
  discountAmountMinor: number;
  netAmountMinor: number;
  serviceDate: string;
};

export type RevenueInvoice = {
  id: string;
  organizationId: string;
  branchId: string;
  number: string;
  patientId: string;
  encounterId: string;
  accountId: string;
  payer: string;
  status: InvoiceStatus;
  lines: RevenueInvoiceLine[];
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  paidMinor: number;
  balanceMinor: number;
  currency: CurrencyCode;
  issuedAt: string;
  dueAt?: string;
  correlationId: string;
  /** Present when the invoice was created through an idempotent command boundary. */
  idempotencyKey?: string;
  createdAt: string;
  createdBy: string;
};

export type Payment = {
  id: string;
  organizationId: string;
  patientId: string;
  accountId: string;
  amountMinor: number;
  currency: CurrencyCode;
  method: PaymentMethod;
  paymentDate: string;
  reference?: string;
  receivingAccount: string;
  notes?: string;
  receivedBy: string;
  status: PaymentStatus;
  correlationId: string;
  /** Prevents duplicate collection when a client retries a timed-out request. */
  idempotencyKey?: string;
  createdAt: string;
};

export type PaymentAllocation = {
  id: string;
  paymentId: string;
  invoiceId: string;
  amountMinor: number;
  createdAt: string;
};

export type Receipt = {
  id: string;
  number: string;
  organizationId: string;
  paymentId: string;
  invoiceId: string;
  patientId: string;
  amountMinor: number;
  currency: CurrencyCode;
  issuedAt: string;
};

export type ChargeException = {
  id: string;
  organizationId: string;
  sourceEventId: string;
  idempotencyKey?: string;
  patientId: string;
  encounterId?: string;
  reason: "MISSING_PRICE" | "DUPLICATE_SUSPECTED" | "MISSING_ACCOUNT" | "INVALID_SERVICE" | "INVALID_QUANTITY";
  detail: string;
  status: "NEEDS_REVIEW" | "RESOLVED";
  createdAt: string;
};

export type BillingAuditEvent = {
  id: string;
  organizationId: string;
  actorId: string;
  actor: string;
  role: string;
  patientId: string;
  encounterId: string;
  accountId: string;
  resourceType: "PATIENT_ACCOUNT" | "CHARGE" | "INVOICE" | "PAYMENT" | "ALLOCATION" | "RECEIPT";
  resourceId: string;
  action: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason?: string;
  timestamp: string;
  correlationId: string;
};

export type ChargeEventInput = {
  patientId: string;
  encounterId?: string;
  appointmentId?: string;
  visitType?: string;
  payer: string;
  sourceType: ChargeSourceType;
  sourceId: string;
  sourceEventId: string;
  idempotencyKey?: string;
  serviceCode?: string;
  serviceName?: string;
  quantity: number;
  department: string;
  performedBy: string;
  performedAt: string;
};

export const invoiceStatusFor = (totalMinor: number, paidMinor: number): InvoiceStatus => {
  if (paidMinor <= 0) return "ISSUED";
  if (paidMinor < totalMinor) return "PARTIALLY_PAID";
  return "PAID";
};

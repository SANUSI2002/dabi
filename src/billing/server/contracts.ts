import type {
  BillingAuditEvent,
  ChargeEventInput,
  ChargeException,
  ChargeItem,
  PatientAccount,
  Payment,
  PaymentAllocation,
  PaymentMethod,
  PriceVersion,
  Receipt,
  RevenueInvoice,
  ServiceCatalogItem,
} from "../domain";

export type BillingPermission =
  | "billing.account.open"
  | "billing.charge.capture"
  | "billing.invoice.issue"
  | "billing.payment.record"
  | "billing.audit.read";

/**
 * Built only from an authenticated server session or verified access token.
 * organizationId and branchIds must never be accepted from request JSON.
 */
export type TenantBillingContext = {
  organizationId: string;
  branchIds: string[];
  actorId: string;
  actorName: string;
  actorRole: string;
  permissions: BillingPermission[];
  correlationId?: string;
};

export type EnsurePatientAccountCommand = {
  patientId: string;
  encounterId: string;
  appointmentId?: string;
  branchId: string;
  visitType: string;
  attendingProvider?: string;
  payer: string;
  currency: string;
  openedAt?: string;
};

export type CaptureChargeCommand = ChargeEventInput & {
  branchId: string;
  idempotencyKey: string;
};

export type IssueInvoiceCommand = {
  accountId: string;
  chargeIds?: string[];
  idempotencyKey: string;
  dueAt?: string;
};

export type UpdateBillingReadinessCommand = {
  encounterId: string;
  reasons: string[];
  updatedAt?: string;
};

export type RecordPaymentCommand = {
  invoiceId: string;
  amountMinor: number;
  method: PaymentMethod;
  paymentDate: string;
  reference?: string;
  receivingAccount: string;
  notes?: string;
  idempotencyKey: string;
};

export type StoredInvoice = RevenueInvoice & { idempotencyKey: string };
export type StoredPayment = Payment & { idempotencyKey: string; branchId: string };
export type StoredAllocation = PaymentAllocation & { organizationId: string; branchId: string };
export type StoredChargeException = ChargeException & { idempotencyKey: string; branchId: string };
export type StoredReceipt = Receipt & { branchId: string };
export type StoredAuditEvent = BillingAuditEvent & { branchId: string };
export type BillingOutboxEvent = {
  id: string;
  organizationId: string;
  branchId: string;
  aggregateType: "INVOICE" | "PAYMENT";
  aggregateId: string;
  eventType: "REVENUE_INVOICE_ISSUED" | "REVENUE_PAYMENT_RECORDED";
  payload: Record<string, unknown>;
  correlationId: string;
  occurredAt: string;
};

export type PaymentResult = {
  payment: StoredPayment;
  allocation: StoredAllocation;
  receipt: StoredReceipt;
  invoice: StoredInvoice;
};

export type CaptureChargeResult = {
  charge?: ChargeItem;
  exception?: ChargeException;
  duplicate: boolean;
};

export type ServiceLookup = {
  serviceCode?: string;
  serviceName?: string;
  sourceType: ChargeEventInput["sourceType"];
};

/** All repository calls execute against one SQL transaction and one tenant. */
export interface RevenueCycleTransaction {
  lockIdempotencyKey(organizationId: string, idempotencyKey: string): Promise<void>;
  lockEncounterAccountKey(organizationId: string, encounterId: string): Promise<void>;
  nextDocumentNumber(organizationId: string, branchId: string, kind: "ACCOUNT" | "INVOICE" | "RECEIPT", at: string): Promise<string>;

  findAccountByEncounterForUpdate(organizationId: string, encounterId: string): Promise<PatientAccount | undefined>;
  findAccountForUpdate(organizationId: string, accountId: string): Promise<PatientAccount | undefined>;
  insertAccount(account: PatientAccount): Promise<void>;
  updateAccount(organizationId: string, accountId: string, patch: Partial<Pick<PatientAccount, "financialStatus" | "readinessReasons" | "updatedAt">>): Promise<void>;

  findService(organizationId: string, lookup: ServiceLookup): Promise<ServiceCatalogItem | undefined>;
  findPrice(organizationId: string, serviceId: string, payer: string, performedAt: string): Promise<PriceVersion | undefined>;
  findChargeByIdempotency(organizationId: string, idempotencyKey: string): Promise<ChargeItem | undefined>;
  findOpenExceptionByIdempotency(organizationId: string, idempotencyKey: string): Promise<StoredChargeException | undefined>;
  insertCharge(charge: ChargeItem): Promise<void>;
  insertChargeException(exception: StoredChargeException): Promise<void>;
  listBillableChargesForUpdate(organizationId: string, accountId: string, chargeIds?: string[]): Promise<ChargeItem[]>;
  hasBillableCharges(organizationId: string, accountId: string): Promise<boolean>;
  markChargesInvoiced(organizationId: string, chargeIds: string[], invoiceId: string): Promise<void>;
  markInvoiceChargesPaid(organizationId: string, invoiceId: string): Promise<void>;

  findInvoiceByIdempotency(organizationId: string, idempotencyKey: string): Promise<StoredInvoice | undefined>;
  findInvoiceForUpdate(organizationId: string, invoiceId: string): Promise<StoredInvoice | undefined>;
  insertInvoice(invoice: StoredInvoice): Promise<void>;
  updateInvoicePaymentState(organizationId: string, invoiceId: string, patch: Pick<RevenueInvoice, "paidMinor" | "balanceMinor" | "status">): Promise<StoredInvoice>;

  findPaymentResultByIdempotency(organizationId: string, idempotencyKey: string): Promise<PaymentResult | undefined>;
  insertPayment(payment: StoredPayment): Promise<void>;
  insertAllocation(allocation: StoredAllocation): Promise<void>;
  insertReceipt(receipt: StoredReceipt): Promise<void>;
  insertAuditEvents(events: StoredAuditEvent[]): Promise<void>;
  insertOutboxEvents(events: BillingOutboxEvent[]): Promise<void>;
}

export interface RevenueCycleRepository {
  transaction<T>(organizationId: string, work: (transaction: RevenueCycleTransaction) => Promise<T>): Promise<T>;
}

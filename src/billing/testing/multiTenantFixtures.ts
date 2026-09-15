import type {
  BillingAuditEvent,
  ChargeException,
  ChargeItem,
  PatientAccount,
  Payment,
  PaymentAllocation,
  PriceVersion,
  Receipt,
  RevenueInvoice,
  ServiceCatalogItem,
} from "../domain";

export type TenantBillingFixture = {
  organizationId: string;
  branchId: string;
  accounts: PatientAccount[];
  charges: ChargeItem[];
  invoices: RevenueInvoice[];
  payments: Payment[];
  allocations: PaymentAllocation[];
  receipts: Receipt[];
  exceptions: ChargeException[];
  auditEvents: BillingAuditEvent[];
  serviceCatalog: ServiceCatalogItem[];
  priceVersions: PriceVersion[];
};

const FIXTURE_TIME = "2026-09-15T09:00:00.000Z";

const safeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** Repeatable data for UI, contract and tenant-isolation tests; no random IDs or current dates. */
export function makeTenantBillingFixture(organizationId: string, branchId: string): TenantBillingFixture {
  const key = safeKey(`${organizationId}-${branchId}`);
  const readyAccountId = `fixture-${key}-account-ready`;
  const blockedAccountId = `fixture-${key}-account-blocked`;
  const readyEncounterId = `fixture-${key}-encounter-ready`;
  const blockedEncounterId = `fixture-${key}-encounter-blocked`;
  const serviceId = `fixture-${key}-consultation`;
  const priceId = `fixture-${key}-price-self-pay`;
  const invoicedChargeId = `fixture-${key}-charge-invoiced`;
  const billableChargeId = `fixture-${key}-charge-billable`;
  const invoiceId = `fixture-${key}-invoice-partial`;
  const paymentId = `fixture-${key}-payment-partial`;
  const totalMinor = 10_000_00;
  const paidMinor = 4_000_00;

  const accounts: PatientAccount[] = [
    {
      id: readyAccountId, number: "ACC/2026/000001", organizationId, branchId,
      patientId: `fixture-${key}-patient-ready`, encounterId: readyEncounterId,
      visitType: "Outpatient", attendingProvider: "Dr. Fixture", payer: "Out of Pocket", currency: "NGN",
      financialStatus: "PARTIALLY_PAID", readinessReasons: [], openedAt: FIXTURE_TIME, updatedAt: FIXTURE_TIME,
    },
    {
      id: blockedAccountId, number: "ACC/2026/000002", organizationId, branchId,
      patientId: `fixture-${key}-patient-blocked`, encounterId: blockedEncounterId,
      visitType: "Outpatient", attendingProvider: "Dr. Fixture", payer: "Out of Pocket", currency: "NGN",
      financialStatus: "ACCUMULATING_CHARGES", readinessReasons: ["Laboratory: 1 specimen pending"],
      openedAt: FIXTURE_TIME, updatedAt: FIXTURE_TIME,
    },
  ];

  const charge = (id: string, account: PatientAccount, status: ChargeItem["status"], idempotencyKey: string): ChargeItem => ({
    id, organizationId, branchId, patientId: account.patientId, encounterId: account.encounterId, accountId: account.id,
    sourceType: "CONSULTATION", sourceId: account.encounterId, sourceEventId: "fixture-consultation-completed",
    idempotencyKey, serviceId, serviceCode: "CONS", description: "General Consultation", department: "Consultation",
    quantity: 1, unitPriceMinor: totalMinor, grossAmountMinor: totalMinor, discountAmountMinor: 0,
    netAmountMinor: totalMinor, currency: "NGN", status, performedBy: "Dr. Fixture", performedAt: FIXTURE_TIME,
    priceListId: "SELF_PAY_2026", priceVersionId: priceId, invoiceId: status === "INVOICED" ? invoiceId : undefined,
    correlationId: `fixture-${key}-correlation`, createdAt: FIXTURE_TIME, createdBy: "Fixture Builder",
  });

  const charges = [
    charge(invoicedChargeId, accounts[0], "INVOICED", "fixture-charge-invoice-idempotency"),
    charge(billableChargeId, accounts[1], "BILLABLE", "fixture-charge-blocked-idempotency"),
  ];
  const invoices: RevenueInvoice[] = [{
    id: invoiceId, organizationId, branchId, number: "INV/2026/000001", idempotencyKey: "fixture-invoice-idempotency",
    patientId: accounts[0].patientId, encounterId: readyEncounterId, accountId: readyAccountId,
    payer: accounts[0].payer, status: "PARTIALLY_PAID", lines: [{
      id: `fixture-${key}-invoice-line`, chargeItemId: invoicedChargeId, serviceCode: "CONS",
      description: "General Consultation", department: "Consultation", quantity: 1, unitPriceMinor: totalMinor,
      grossAmountMinor: totalMinor, discountAmountMinor: 0, netAmountMinor: totalMinor, serviceDate: FIXTURE_TIME,
    }],
    subtotalMinor: totalMinor, discountMinor: 0, taxMinor: 0, totalMinor, paidMinor,
    balanceMinor: totalMinor - paidMinor, currency: "NGN", issuedAt: FIXTURE_TIME,
    correlationId: `fixture-${key}-correlation`, createdAt: FIXTURE_TIME, createdBy: "Fixture Builder",
  }];
  const payments: Payment[] = [{
    id: paymentId, organizationId, patientId: accounts[0].patientId, accountId: readyAccountId,
    amountMinor: paidMinor, currency: "NGN", method: "BANK_TRANSFER", paymentDate: FIXTURE_TIME,
    reference: `FIXTURE-${key.toUpperCase()}`, receivingAccount: "Fixture bank account", receivedBy: "Fixture Cashier",
    status: "SUCCEEDED", correlationId: `fixture-${key}-correlation`, idempotencyKey: "fixture-payment-idempotency", createdAt: FIXTURE_TIME,
  }];
  const allocations: PaymentAllocation[] = [{
    id: `fixture-${key}-allocation`, paymentId, invoiceId, amountMinor: paidMinor, createdAt: FIXTURE_TIME,
  }];
  const receipts: Receipt[] = [{
    id: `fixture-${key}-receipt`, number: "REC/2026/000001", organizationId, paymentId, invoiceId,
    patientId: accounts[0].patientId, amountMinor: paidMinor, currency: "NGN", issuedAt: FIXTURE_TIME,
  }];
  const exceptions: ChargeException[] = [{
    id: `fixture-${key}-exception`, organizationId, sourceEventId: "fixture-unpriced-service",
    idempotencyKey: "fixture-missing-price-idempotency", patientId: accounts[1].patientId,
    encounterId: blockedEncounterId, reason: "MISSING_PRICE", detail: "Fixture service has no active price.",
    status: "NEEDS_REVIEW", createdAt: FIXTURE_TIME,
  }];
  const auditEvents: BillingAuditEvent[] = [{
    id: `fixture-${key}-audit`, organizationId, actorId: "fixture-user", actor: "Fixture Cashier", role: "Cashier",
    patientId: accounts[0].patientId, encounterId: readyEncounterId, accountId: readyAccountId,
    resourceType: "PAYMENT", resourceId: paymentId, action: "PAYMENT_RECORDED",
    newValue: { invoiceId, amountMinor: paidMinor }, timestamp: FIXTURE_TIME, correlationId: `fixture-${key}-correlation`,
  }];
  const serviceCatalog: ServiceCatalogItem[] = [{
    id: serviceId, organizationId, code: "CONS", name: "General Consultation", aliases: [],
    department: "Consultation", category: "Consultation", revenueAccountCode: "4000", active: true,
  }];
  const priceVersions: PriceVersion[] = [{
    id: priceId, serviceId, priceListId: "SELF_PAY_2026", payerType: "DEFAULT",
    amountMinor: totalMinor, currency: "NGN", effectiveFrom: "2026-01-01T00:00:00.000Z", active: true,
  }];

  return { organizationId, branchId, accounts, charges, invoices, payments, allocations, receipts, exceptions, auditEvents, serviceCatalog, priceVersions };
}

export const MULTI_TENANT_BILLING_FIXTURES = [
  makeTenantBillingFixture("org-sabi", "PHC-SABI-014"),
  makeTenantBillingFixture("org-mercy", "MERCY-HQ-001"),
];

export function verifyMultiTenantBillingFixtures(fixtures = MULTI_TENANT_BILLING_FIXTURES) {
  const failures: string[] = [];
  const scopedKeys = new Set<string>();
  for (const fixture of fixtures) {
    const recordsWithTenant = [...fixture.accounts, ...fixture.charges, ...fixture.invoices, ...fixture.payments, ...fixture.receipts, ...fixture.exceptions, ...fixture.auditEvents, ...fixture.serviceCatalog];
    if (recordsWithTenant.some((record) => record.organizationId !== fixture.organizationId)) failures.push(`${fixture.organizationId}: cross-tenant record detected`);
    if ([...fixture.accounts, ...fixture.charges, ...fixture.invoices].some((record) => record.branchId !== fixture.branchId)) failures.push(`${fixture.organizationId}: cross-branch record detected`);
    for (const charge of fixture.charges) {
      const scopedKey = `${fixture.organizationId}:${charge.idempotencyKey}`;
      if (scopedKeys.has(scopedKey)) failures.push(`${fixture.organizationId}: duplicate scoped idempotency key`);
      scopedKeys.add(scopedKey);
    }
    for (const invoice of fixture.invoices) {
      if (invoice.balanceMinor !== invoice.totalMinor - invoice.paidMinor) failures.push(`${fixture.organizationId}: invalid invoice balance`);
      const expectedStatus = invoice.paidMinor <= 0 ? "ISSUED" : invoice.paidMinor < invoice.totalMinor ? "PARTIALLY_PAID" : "PAID";
      if (invoice.status !== expectedStatus) failures.push(`${fixture.organizationId}: invalid calculated payment status`);
      const allocated = fixture.allocations.filter((item) => item.invoiceId === invoice.id).reduce((sum, item) => sum + item.amountMinor, 0);
      if (allocated !== invoice.paidMinor) failures.push(`${fixture.organizationId}: allocations do not reconcile to paid amount`);
    }
    const blocked = fixture.accounts.find((account) => account.readinessReasons.length > 0);
    if (!blocked || blocked.financialStatus === "READY_TO_BILL") failures.push(`${fixture.organizationId}: readiness blocker is not enforced`);
  }
  if (failures.length) throw new Error(failures.join("\n"));
  return { tenants: fixtures.length, invoices: fixtures.reduce((sum, fixture) => sum + fixture.invoices.length, 0), status: "ok" as const };
}

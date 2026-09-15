import { invoiceStatusFor, type BillingAuditEvent, type ChargeException, type ChargeItem, type PatientAccount } from "../domain";
import type {
  CaptureChargeCommand,
  CaptureChargeResult,
  EnsurePatientAccountCommand,
  IssueInvoiceCommand,
  PaymentResult,
  RecordPaymentCommand,
  RevenueCycleRepository,
  RevenueCycleTransaction,
  StoredAllocation,
  StoredAuditEvent,
  StoredChargeException,
  StoredInvoice,
  StoredPayment,
  StoredReceipt,
  TenantBillingContext,
  BillingPermission,
  BillingOutboxEvent,
  UpdateBillingReadinessCommand,
} from "./contracts";

export type BillingErrorCode =
  | "FORBIDDEN"
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "BILLING_NOT_READY"
  | "NO_BILLABLE_CHARGES"
  | "CURRENCY_MISMATCH"
  | "PAYMENT_NOT_ALLOWED";

export class BillingServiceError extends Error {
  readonly code: BillingErrorCode;
  readonly status: number;

  constructor(code: BillingErrorCode, message: string, status = 400) {
    super(message);
    this.name = "BillingServiceError";
    this.code = code;
    this.status = status;
  }
}

const newId = (prefix: string) => `${prefix}-${globalThis.crypto.randomUUID()}`;
function requirePermission(context: TenantBillingContext, permission: BillingPermission) {
  if (!context.organizationId || !context.actorId || !context.permissions.includes(permission)) {
    throw new BillingServiceError("FORBIDDEN", `Missing permission: ${permission}.`, 403);
  }
}

function requireBranch(context: TenantBillingContext, branchId: string) {
  if (!branchId || !context.branchIds.includes(branchId)) {
    throw new BillingServiceError("FORBIDDEN", "This branch is outside the authenticated tenant scope.", 403);
  }
}

function requireIdempotencyKey(value: string) {
  const key = value.trim();
  if (key.length < 8 || key.length > 200) throw new BillingServiceError("INVALID_REQUEST", "Provide an idempotency key between 8 and 200 characters.");
  return key;
}

export class RevenueCycleService {
  private readonly repository: RevenueCycleRepository;
  private readonly clock: () => Date;

  constructor(repository: RevenueCycleRepository, clock: () => Date = () => new Date()) {
    this.repository = repository;
    this.clock = clock;
  }

  async ensurePatientAccount(context: TenantBillingContext, command: EnsurePatientAccountCommand) {
    requirePermission(context, "billing.account.open");
    requireBranch(context, command.branchId);
    if (!command.patientId || !command.encounterId || !command.payer || !command.currency) {
      throw new BillingServiceError("INVALID_REQUEST", "Patient, encounter, payer and currency are required.");
    }
    return this.repository.transaction(context.organizationId, (transaction) =>
      this.ensureAccount(transaction, context, command, command.openedAt ?? this.clock().toISOString()),
    );
  }

  async captureCharge(context: TenantBillingContext, command: CaptureChargeCommand): Promise<CaptureChargeResult> {
    requirePermission(context, "billing.charge.capture");
    requireBranch(context, command.branchId);
    const idempotencyKey = requireIdempotencyKey(command.idempotencyKey);
    const encounterId = command.encounterId;
    if (!command.patientId || !encounterId || !command.sourceEventId || !command.sourceId) {
      throw new BillingServiceError("INVALID_REQUEST", "Patient, encounter and source event identifiers are required.");
    }
    if (!Number.isSafeInteger(command.quantity) || command.quantity <= 0) {
      throw new BillingServiceError("INVALID_REQUEST", "Charge quantity must be a positive integer.");
    }

    return this.repository.transaction(context.organizationId, async (transaction) => {
      await transaction.lockIdempotencyKey(context.organizationId, idempotencyKey);
      const existing = await transaction.findChargeByIdempotency(context.organizationId, idempotencyKey);
      if (existing) return { charge: existing, duplicate: true };

      const existingException = await transaction.findOpenExceptionByIdempotency(context.organizationId, idempotencyKey);
      if (existingException) return { exception: existingException, duplicate: true };

      const service = await transaction.findService(context.organizationId, {
        serviceCode: command.serviceCode,
        serviceName: command.serviceName,
        sourceType: command.sourceType,
      });
      if (!service) return this.captureException(transaction, context, command, idempotencyKey, "INVALID_SERVICE", "No active service matches this clinical event.");

      const price = await transaction.findPrice(context.organizationId, service.id, command.payer, command.performedAt);
      if (!price || price.amountMinor <= 0) {
        return this.captureException(transaction, context, command, idempotencyKey, "MISSING_PRICE", `${service.name} has no active billable price for this payer.`);
      }

      const account = await this.ensureAccount(transaction, context, {
        patientId: command.patientId,
        encounterId,
        appointmentId: command.appointmentId,
        branchId: command.branchId,
        visitType: command.visitType ?? "Outpatient",
        attendingProvider: command.performedBy,
        payer: command.payer,
        currency: price.currency,
      }, command.performedAt);
      const now = this.clock().toISOString();
      const correlationId = context.correlationId ?? newId("corr");
      const grossAmountMinor = price.amountMinor * command.quantity;
      const charge: ChargeItem = {
        id: newId("chg"), organizationId: context.organizationId, branchId: command.branchId,
        patientId: command.patientId, encounterId, accountId: account.id,
        sourceType: command.sourceType, sourceId: command.sourceId, sourceEventId: command.sourceEventId,
        idempotencyKey, serviceId: service.id, serviceCode: service.code, description: service.name,
        department: command.department || service.department, quantity: command.quantity,
        unitPriceMinor: price.amountMinor, grossAmountMinor, discountAmountMinor: 0, netAmountMinor: grossAmountMinor,
        currency: price.currency, status: "BILLABLE", performedBy: command.performedBy,
        performedAt: command.performedAt, priceListId: price.priceListId, priceVersionId: price.id,
        correlationId, createdAt: now, createdBy: context.actorName,
      };
      await transaction.insertCharge(charge);
      await transaction.updateAccount(context.organizationId, account.id, { financialStatus: "ACCUMULATING_CHARGES", updatedAt: now });
      await transaction.insertAuditEvents([this.audit(context, account, "CHARGE", charge.id, "CHARGE_CREATED", correlationId, {
        serviceCode: charge.serviceCode, quantity: charge.quantity, amountMinor: charge.netAmountMinor,
        sourceEventId: charge.sourceEventId, idempotencyKey,
      })]);
      return { charge, duplicate: false };
    });
  }

  async issueInvoice(context: TenantBillingContext, command: IssueInvoiceCommand): Promise<StoredInvoice> {
    requirePermission(context, "billing.invoice.issue");
    const idempotencyKey = requireIdempotencyKey(command.idempotencyKey);
    return this.repository.transaction(context.organizationId, async (transaction) => {
      await transaction.lockIdempotencyKey(context.organizationId, idempotencyKey);
      const duplicate = await transaction.findInvoiceByIdempotency(context.organizationId, idempotencyKey);
      if (duplicate) return duplicate;
      const account = await transaction.findAccountForUpdate(context.organizationId, command.accountId);
      if (!account) throw new BillingServiceError("NOT_FOUND", "Patient account was not found.", 404);
      requireBranch(context, account.branchId);
      if (account.readinessReasons.length) {
        throw new BillingServiceError("BILLING_NOT_READY", `Billing is waiting for: ${account.readinessReasons.join("; ")}.`, 409);
      }
      const charges = await transaction.listBillableChargesForUpdate(context.organizationId, account.id, command.chargeIds);
      if (!charges.length) throw new BillingServiceError("NO_BILLABLE_CHARGES", "No billable charges are available for this account.", 409);
      if (charges.some((charge) => charge.accountId !== account.id || charge.branchId !== account.branchId)) {
        throw new BillingServiceError("FORBIDDEN", "A selected charge is outside this account or branch.", 403);
      }
      if (charges.some((charge) => charge.currency !== account.currency)) {
        throw new BillingServiceError("CURRENCY_MISMATCH", "All invoice charges must use the patient account currency.", 409);
      }

      const now = this.clock().toISOString();
      const correlationId = context.correlationId ?? newId("corr");
      const subtotalMinor = charges.reduce((sum, charge) => sum + charge.grossAmountMinor, 0);
      const discountMinor = charges.reduce((sum, charge) => sum + charge.discountAmountMinor, 0);
      const totalMinor = charges.reduce((sum, charge) => sum + charge.netAmountMinor, 0);
      const invoice: StoredInvoice = {
        id: newId("inv"), idempotencyKey, organizationId: context.organizationId, branchId: account.branchId,
        number: await transaction.nextDocumentNumber(context.organizationId, account.branchId, "INVOICE", now),
        patientId: account.patientId, encounterId: account.encounterId, accountId: account.id, payer: account.payer,
        status: "ISSUED", lines: charges.map((charge) => ({
          id: newId("invl"), chargeItemId: charge.id, serviceCode: charge.serviceCode, description: charge.description,
          department: charge.department, quantity: charge.quantity, unitPriceMinor: charge.unitPriceMinor,
          grossAmountMinor: charge.grossAmountMinor, discountAmountMinor: charge.discountAmountMinor,
          netAmountMinor: charge.netAmountMinor, serviceDate: charge.performedAt,
        })),
        subtotalMinor, discountMinor, taxMinor: 0, totalMinor, paidMinor: 0, balanceMinor: totalMinor,
        currency: account.currency, issuedAt: now, dueAt: command.dueAt, correlationId, createdAt: now, createdBy: context.actorName,
      };
      await transaction.insertInvoice(invoice);
      await transaction.markChargesInvoiced(context.organizationId, charges.map((charge) => charge.id), invoice.id);
      await transaction.updateAccount(context.organizationId, account.id, { financialStatus: "INVOICED", updatedAt: now });
      await transaction.insertAuditEvents([this.audit(context, account, "INVOICE", invoice.id, "INVOICE_ISSUED", correlationId, {
        number: invoice.number, totalMinor, chargeIds: charges.map((charge) => charge.id), idempotencyKey,
      })]);
      await transaction.insertOutboxEvents([this.outbox(invoice.organizationId, invoice.branchId, "INVOICE", invoice.id, "REVENUE_INVOICE_ISSUED", correlationId, now, {
        invoiceId: invoice.id, accountId: invoice.accountId, invoiceNumber: invoice.number,
        totalMinor: invoice.totalMinor, currency: invoice.currency,
      })]);
      return invoice;
    });
  }

  async recordPayment(context: TenantBillingContext, command: RecordPaymentCommand): Promise<PaymentResult> {
    requirePermission(context, "billing.payment.record");
    const idempotencyKey = requireIdempotencyKey(command.idempotencyKey);
    if (!Number.isSafeInteger(command.amountMinor) || command.amountMinor <= 0 || !command.receivingAccount.trim()) {
      throw new BillingServiceError("INVALID_REQUEST", "A positive amount and receiving account are required.");
    }
    if (Number.isNaN(Date.parse(command.paymentDate))) throw new BillingServiceError("INVALID_REQUEST", "Payment date is invalid.");

    return this.repository.transaction(context.organizationId, async (transaction) => {
      await transaction.lockIdempotencyKey(context.organizationId, idempotencyKey);
      const duplicate = await transaction.findPaymentResultByIdempotency(context.organizationId, idempotencyKey);
      if (duplicate) return duplicate;
      const invoice = await transaction.findInvoiceForUpdate(context.organizationId, command.invoiceId);
      if (!invoice) throw new BillingServiceError("NOT_FOUND", "Invoice was not found.", 404);
      requireBranch(context, invoice.branchId);
      if (["PAID", "VOIDED", "CANCELLED", "CREDITED"].includes(invoice.status) || command.amountMinor > invoice.balanceMinor) {
        throw new BillingServiceError("PAYMENT_NOT_ALLOWED", "The payment exceeds the outstanding balance or the invoice is closed.", 409);
      }

      const now = this.clock().toISOString();
      const correlationId = context.correlationId ?? newId("corr");
      const payment: StoredPayment = {
        id: newId("pay"), idempotencyKey, organizationId: context.organizationId, branchId: invoice.branchId, patientId: invoice.patientId,
        accountId: invoice.accountId, amountMinor: command.amountMinor, currency: invoice.currency, method: command.method,
        paymentDate: command.paymentDate, reference: command.reference?.trim() || undefined,
        receivingAccount: command.receivingAccount.trim(), notes: command.notes?.trim() || undefined,
        receivedBy: context.actorName, status: "SUCCEEDED", correlationId, createdAt: now,
      };
      const allocation: StoredAllocation = {
        id: newId("alloc"), organizationId: context.organizationId, branchId: invoice.branchId, paymentId: payment.id,
        invoiceId: invoice.id, amountMinor: payment.amountMinor, createdAt: now,
      };
      const receipt: StoredReceipt = {
        id: newId("rec"), number: await transaction.nextDocumentNumber(context.organizationId, invoice.branchId, "RECEIPT", now),
        organizationId: context.organizationId, branchId: invoice.branchId, paymentId: payment.id, invoiceId: invoice.id,
        patientId: invoice.patientId, amountMinor: payment.amountMinor, currency: invoice.currency, issuedAt: now,
      };
      const paidMinor = invoice.paidMinor + command.amountMinor;
      const updated = await transaction.updateInvoicePaymentState(context.organizationId, invoice.id, {
        paidMinor, balanceMinor: invoice.totalMinor - paidMinor, status: invoiceStatusFor(invoice.totalMinor, paidMinor),
      });
      await transaction.insertPayment(payment);
      await transaction.insertAllocation(allocation);
      await transaction.insertReceipt(receipt);
      if (updated.status === "PAID") await transaction.markInvoiceChargesPaid(context.organizationId, invoice.id);
      await transaction.updateAccount(context.organizationId, invoice.accountId, {
        financialStatus: updated.status === "PAID" ? "PAID" : "PARTIALLY_PAID", updatedAt: now,
      });
      const account: PatientAccount = {
        id: invoice.accountId, number: "", organizationId: context.organizationId, branchId: invoice.branchId,
        patientId: invoice.patientId, encounterId: invoice.encounterId, visitType: "", payer: invoice.payer,
        currency: invoice.currency, financialStatus: "PARTIALLY_PAID", readinessReasons: [], openedAt: invoice.createdAt, updatedAt: now,
      };
      await transaction.insertAuditEvents([
        this.audit(context, account, "PAYMENT", payment.id, "PAYMENT_RECORDED", correlationId, {
          invoiceId: invoice.id, receiptNumber: receipt.number, amountMinor: payment.amountMinor,
          method: payment.method, reference: payment.reference, idempotencyKey,
        }),
        this.audit(context, account, "ALLOCATION", allocation.id, "PAYMENT_ALLOCATED", correlationId, {
          invoiceId: invoice.id, paymentId: payment.id, amountMinor: allocation.amountMinor,
        }),
      ]);
      await transaction.insertOutboxEvents([this.outbox(context.organizationId, invoice.branchId, "PAYMENT", payment.id, "REVENUE_PAYMENT_RECORDED", correlationId, now, {
        paymentId: payment.id, invoiceId: invoice.id, accountId: invoice.accountId,
        amountMinor: payment.amountMinor, currency: payment.currency, method: payment.method,
      })]);
      return { payment, allocation, receipt, invoice: updated };
    });
  }

  async updateBillingReadiness(context: TenantBillingContext, command: UpdateBillingReadinessCommand): Promise<PatientAccount> {
    requirePermission(context, "billing.charge.capture");
    if (!command.encounterId || command.reasons.some((reason) => !reason.trim() || reason.length > 240)) {
      throw new BillingServiceError("INVALID_REQUEST", "Encounter and concise readiness reasons are required.");
    }
    const reasons = [...new Set(command.reasons.map((reason) => reason.trim()))];
    return this.repository.transaction(context.organizationId, async (transaction) => {
      const account = await transaction.findAccountByEncounterForUpdate(context.organizationId, command.encounterId);
      if (!account) throw new BillingServiceError("NOT_FOUND", "Patient account was not found for this encounter.", 404);
      requireBranch(context, account.branchId);
      const hasCharges = await transaction.hasBillableCharges(context.organizationId, account.id);
      const isPostInvoice = ["PARTIALLY_INVOICED", "INVOICED", "PARTIALLY_PAID", "PAID", "CREDIT_BALANCE", "WRITTEN_OFF", "FINANCIALLY_CLOSED"].includes(account.financialStatus);
      const financialStatus = isPostInvoice
        ? account.financialStatus
        : reasons.length ? (hasCharges ? "ACCUMULATING_CHARGES" : "OPEN") : hasCharges ? "READY_TO_BILL" : "OPEN";
      const updatedAt = command.updatedAt ?? this.clock().toISOString();
      await transaction.updateAccount(context.organizationId, account.id, { readinessReasons: reasons, financialStatus, updatedAt });
      return { ...account, readinessReasons: reasons, financialStatus, updatedAt };
    });
  }

  private async ensureAccount(transaction: RevenueCycleTransaction, context: TenantBillingContext, command: EnsurePatientAccountCommand, at: string) {
    await transaction.lockEncounterAccountKey(context.organizationId, command.encounterId);
    const existing = await transaction.findAccountByEncounterForUpdate(context.organizationId, command.encounterId);
    if (existing) {
      requireBranch(context, existing.branchId);
      if (existing.patientId !== command.patientId) throw new BillingServiceError("FORBIDDEN", "Encounter and patient account do not match.", 403);
      return existing;
    }
    const account: PatientAccount = {
      id: newId("acc"), number: await transaction.nextDocumentNumber(context.organizationId, command.branchId, "ACCOUNT", at),
      organizationId: context.organizationId, branchId: command.branchId, patientId: command.patientId,
      encounterId: command.encounterId, appointmentId: command.appointmentId, visitType: command.visitType,
      attendingProvider: command.attendingProvider, payer: command.payer, currency: command.currency,
      financialStatus: "OPEN", readinessReasons: ["Consultation in progress"], openedAt: at, updatedAt: at,
    };
    await transaction.insertAccount(account);
    const correlationId = context.correlationId ?? newId("corr");
    await transaction.insertAuditEvents([this.audit(context, account, "PATIENT_ACCOUNT", account.id, "PATIENT_ACCOUNT_CREATED", correlationId, {
      number: account.number, encounterId: account.encounterId,
    })]);
    return account;
  }

  private async captureException(
    transaction: RevenueCycleTransaction,
    context: TenantBillingContext,
    command: CaptureChargeCommand,
    idempotencyKey: string,
    reason: ChargeException["reason"],
    detail: string,
  ): Promise<CaptureChargeResult> {
    const exception: StoredChargeException = {
      id: newId("exc"), organizationId: context.organizationId, branchId: command.branchId,
      sourceEventId: command.sourceEventId, idempotencyKey,
      patientId: command.patientId, encounterId: command.encounterId, reason, detail,
      status: "NEEDS_REVIEW", createdAt: this.clock().toISOString(),
    };
    await transaction.insertChargeException(exception);
    return { exception, duplicate: false };
  }

  private audit(
    context: TenantBillingContext,
    account: PatientAccount,
    resourceType: BillingAuditEvent["resourceType"],
    resourceId: string,
    action: string,
    correlationId: string,
    newValue: Record<string, unknown>,
  ): StoredAuditEvent {
    return {
      id: newId("ba"), organizationId: context.organizationId, branchId: account.branchId, actorId: context.actorId,
      actor: context.actorName, role: context.actorRole, patientId: account.patientId,
      encounterId: account.encounterId, accountId: account.id, resourceType, resourceId,
      action, newValue, timestamp: this.clock().toISOString(), correlationId,
    };
  }

  private outbox(
    organizationId: string,
    branchId: string,
    aggregateType: BillingOutboxEvent["aggregateType"],
    aggregateId: string,
    eventType: BillingOutboxEvent["eventType"],
    correlationId: string,
    occurredAt: string,
    payload: Record<string, unknown>,
  ): BillingOutboxEvent {
    return { id: newId("outbox"), organizationId, branchId, aggregateType, aggregateId, eventType, payload, correlationId, occurredAt };
  }
}

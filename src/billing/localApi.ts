import { readActiveTenant } from "@/platform/tenantRuntime";
import { useRevenueCycle } from "./useRevenueCycle";
import type { PatientAccount } from "./domain";
import type { RevenueCycleApi } from "./api";
import type {
  CaptureChargeCommand,
  EnsurePatientAccountCommand,
  IssueInvoiceCommand,
  RecordPaymentCommand,
  StoredInvoice,
  UpdateBillingReadinessCommand,
} from "./server/contracts";

function assertActiveBranch(branchId: string) {
  const tenant = readActiveTenant();
  if (branchId !== tenant.facilityCode) throw new Error("The requested branch is outside the active tenant workspace.");
  return tenant;
}

/** Local development adapter implementing the same asynchronous contract as HTTP. */
export class LocalRevenueCycleApi implements RevenueCycleApi {
  async ensurePatientAccount(command: EnsurePatientAccountCommand) {
    assertActiveBranch(command.branchId);
    const account = useRevenueCycle.getState().ensureAccount({
      patientId: command.patientId,
      encounterId: command.encounterId,
      appointmentId: command.appointmentId,
      visitType: command.visitType,
      payer: command.payer,
      performedBy: command.attendingProvider ?? "Unassigned",
      performedAt: command.openedAt ?? new Date().toISOString(),
    });
    if (!account) throw new Error("A local patient account could not be created.");
    return account;
  }

  async captureCharge(command: CaptureChargeCommand) {
    assertActiveBranch(command.branchId);
    return useRevenueCycle.getState().captureCharge({ ...command, idempotencyKey: command.idempotencyKey });
  }

  async issueInvoice(command: IssueInvoiceCommand) {
    const account = useRevenueCycle.getState().accounts.find((item) => item.id === command.accountId);
    if (!account) throw new Error("The local patient account was not found.");
    assertActiveBranch(account.branchId);
    if (account.readinessReasons.length) throw new Error(`Billing is waiting for: ${account.readinessReasons.join("; ")}.`);
    const invoice = useRevenueCycle.getState().generateInvoice(command.accountId, command.chargeIds, command.idempotencyKey);
    if (!invoice) throw new Error("No billable charges are available for this patient account.");
    return { ...invoice, idempotencyKey: command.idempotencyKey } satisfies StoredInvoice;
  }

  async recordPayment(command: RecordPaymentCommand) {
    const currentInvoice = useRevenueCycle.getState().invoices.find((item) => item.id === command.invoiceId);
    const currentAccount = useRevenueCycle.getState().accounts.find((item) => item.id === currentInvoice?.accountId);
    if (!currentInvoice || !currentAccount) throw new Error("The local invoice or patient account was not found.");
    assertActiveBranch(currentAccount.branchId);
    const result = useRevenueCycle.getState().recordPayment(command);
    const account = useRevenueCycle.getState().accounts.find((item) => item.id === result.invoice.accountId);
    if (!account) throw new Error("The local payment account could not be resolved.");
    assertActiveBranch(account.branchId);
    return {
      payment: { ...result.payment, idempotencyKey: command.idempotencyKey, branchId: account.branchId },
      allocation: { ...result.allocation, organizationId: account.organizationId, branchId: account.branchId },
      receipt: { ...result.receipt, branchId: account.branchId },
      invoice: { ...result.invoice, idempotencyKey: result.invoice.idempotencyKey ?? `local-invoice-${result.invoice.id}` },
    };
  }

  async updateBillingReadiness(command: UpdateBillingReadinessCommand): Promise<PatientAccount> {
    useRevenueCycle.getState().updateReadiness(command.encounterId, command.reasons);
    const account = useRevenueCycle.getState().accounts.find((item) => item.encounterId === command.encounterId);
    if (!account) throw new Error("The local patient account was not found.");
    assertActiveBranch(account.branchId);
    return account;
  }
}

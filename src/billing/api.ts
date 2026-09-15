import type { PatientAccount } from "./domain";
import type {
  CaptureChargeCommand,
  CaptureChargeResult,
  EnsurePatientAccountCommand,
  IssueInvoiceCommand,
  PaymentResult,
  RecordPaymentCommand,
  StoredInvoice,
  UpdateBillingReadinessCommand,
} from "./server/contracts";

export class RevenueCycleApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly correlationId?: string;

  constructor(message: string, status: number, code?: string, correlationId?: string) {
    super(message);
    this.name = "RevenueCycleApiError";
    this.status = status;
    this.code = code;
    this.correlationId = correlationId;
  }
}

export interface RevenueCycleApi {
  ensurePatientAccount(command: EnsurePatientAccountCommand): Promise<PatientAccount>;
  captureCharge(command: CaptureChargeCommand): Promise<CaptureChargeResult>;
  issueInvoice(command: IssueInvoiceCommand): Promise<StoredInvoice>;
  recordPayment(command: RecordPaymentCommand): Promise<PaymentResult>;
  updateBillingReadiness(command: UpdateBillingReadinessCommand): Promise<PatientAccount>;
}

type ErrorEnvelope = { error?: { code?: string; message?: string; correlationId?: string } };

/**
 * HTTP adapter for the production service. Tenant identity is deliberately not
 * sent as a request header; the server derives it from the verified access token.
 */
export class HttpRevenueCycleApi implements RevenueCycleApi {
  private readonly baseUrl: string;
  private readonly accessToken: () => Promise<string>;

  constructor(baseUrl: string, accessToken: () => Promise<string>) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.accessToken = accessToken;
  }

  ensurePatientAccount(command: EnsurePatientAccountCommand) {
    return this.request<PatientAccount>("/api/v1/billing/patient-accounts", "POST", command);
  }

  captureCharge(command: CaptureChargeCommand) {
    const { idempotencyKey, ...body } = command;
    return this.request<CaptureChargeResult>("/api/v1/billing/charges", "POST", body, idempotencyKey);
  }

  issueInvoice(command: IssueInvoiceCommand) {
    const { accountId, idempotencyKey, ...body } = command;
    return this.request<StoredInvoice>(`/api/v1/billing/patient-accounts/${encodeURIComponent(accountId)}/invoices`, "POST", body, idempotencyKey);
  }

  recordPayment(command: RecordPaymentCommand) {
    const { invoiceId, idempotencyKey, ...body } = command;
    return this.request<PaymentResult>(`/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/payments`, "POST", body, idempotencyKey);
  }

  updateBillingReadiness(command: UpdateBillingReadinessCommand) {
    const { encounterId, ...body } = command;
    return this.request<PatientAccount>(`/api/v1/billing/encounters/${encodeURIComponent(encounterId)}/readiness`, "POST", body);
  }

  private async request<T>(path: string, method: "GET" | "POST", body?: unknown, idempotencyKey?: string): Promise<T> {
    const token = await this.accessToken();
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      credentials: "include",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (response.ok) return await response.json() as T;
    const payload = await response.json().catch(() => ({})) as ErrorEnvelope;
    throw new RevenueCycleApiError(
      payload.error?.message ?? `Revenue-cycle request failed with HTTP ${response.status}.`,
      response.status,
      payload.error?.code,
      payload.error?.correlationId,
    );
  }
}

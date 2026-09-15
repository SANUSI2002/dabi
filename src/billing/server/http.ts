import { BillingServiceError, RevenueCycleService } from "./service";
import type {
  CaptureChargeCommand,
  EnsurePatientAccountCommand,
  IssueInvoiceCommand,
  RecordPaymentCommand,
  TenantBillingContext,
  UpdateBillingReadinessCommand,
} from "./contracts";

export type BillingHttpRequest = {
  method: string;
  url: string;
  headers: Record<string, string | undefined>;
  body?: unknown;
};

export type BillingHttpResponse = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
};

export type ResolveTenantBillingContext = (request: BillingHttpRequest) => Promise<TenantBillingContext>;

const jsonHeaders = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function objectBody(request: BillingHttpRequest) {
  if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
    throw new BillingServiceError("INVALID_REQUEST", "A JSON object body is required.");
  }
  return request.body as Record<string, unknown>;
}

function header(request: BillingHttpRequest, name: string) {
  const match = Object.entries(request.headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return match?.[1];
}

function requiredIdempotencyKey(request: BillingHttpRequest) {
  const value = header(request, "Idempotency-Key")?.trim();
  if (!value) throw new BillingServiceError("INVALID_REQUEST", "Idempotency-Key header is required.");
  return value;
}

/** Mount this handler inside the server framework; auth remains an injected concern. */
export function createRevenueCycleHttpHandler(service: RevenueCycleService, resolveContext: ResolveTenantBillingContext) {
  return async (request: BillingHttpRequest): Promise<BillingHttpResponse> => {
    let correlationId: string | undefined;
    try {
      const context = await resolveContext(request);
      correlationId = context.correlationId;
      const path = new URL(request.url, "http://sabi.internal").pathname.replace(/\/$/, "");

      if (request.method === "POST" && path === "/api/v1/billing/patient-accounts") {
        const result = await service.ensurePatientAccount(context, objectBody(request) as EnsurePatientAccountCommand);
        return { status: 201, headers: jsonHeaders, body: result };
      }
      if (request.method === "POST" && path === "/api/v1/billing/charges") {
        const result = await service.captureCharge(context, {
          ...objectBody(request) as Omit<CaptureChargeCommand, "idempotencyKey">,
          idempotencyKey: requiredIdempotencyKey(request),
        });
        return { status: result.duplicate ? 200 : 201, headers: jsonHeaders, body: result };
      }

      const invoiceMatch = path.match(/^\/api\/v1\/billing\/patient-accounts\/([^/]+)\/invoices$/);
      if (request.method === "POST" && invoiceMatch) {
        const result = await service.issueInvoice(context, {
          ...objectBody(request) as Omit<IssueInvoiceCommand, "accountId" | "idempotencyKey">,
          accountId: decodeURIComponent(invoiceMatch[1]),
          idempotencyKey: requiredIdempotencyKey(request),
        });
        return { status: 201, headers: jsonHeaders, body: result };
      }

      const paymentMatch = path.match(/^\/api\/v1\/billing\/invoices\/([^/]+)\/payments$/);
      if (request.method === "POST" && paymentMatch) {
        const result = await service.recordPayment(context, {
          ...objectBody(request) as Omit<RecordPaymentCommand, "invoiceId" | "idempotencyKey">,
          invoiceId: decodeURIComponent(paymentMatch[1]),
          idempotencyKey: requiredIdempotencyKey(request),
        });
        return { status: 201, headers: jsonHeaders, body: result };
      }

      const readinessMatch = path.match(/^\/api\/v1\/billing\/encounters\/([^/]+)\/readiness$/);
      if (request.method === "POST" && readinessMatch) {
        const result = await service.updateBillingReadiness(context, {
          ...objectBody(request) as Omit<UpdateBillingReadinessCommand, "encounterId">,
          encounterId: decodeURIComponent(readinessMatch[1]),
        });
        return { status: 200, headers: jsonHeaders, body: result };
      }

      return { status: 404, headers: jsonHeaders, body: { error: { code: "NOT_FOUND", message: "Revenue-cycle route was not found.", correlationId } } };
    } catch (error) {
      if (error instanceof BillingServiceError) {
        return { status: error.status, headers: jsonHeaders, body: { error: { code: error.code, message: error.message, correlationId } } };
      }
      return { status: 500, headers: jsonHeaders, body: { error: { code: "INTERNAL_ERROR", message: "The revenue-cycle request could not be completed.", correlationId } } };
    }
  };
}

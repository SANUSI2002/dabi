export type ApiErrorCode =
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "SERVER_ERROR"
  | "HTTP_ERROR"
  | "INVALID_RESPONSE"
  | "SERVICE_UNAVAILABLE";

export type ValidationIssue = { field?: string; message: string; code?: string };

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status?: number;
  readonly requestId?: string;
  readonly validationIssues: ValidationIssue[];

  constructor(input: {
    message: string;
    code: ApiErrorCode;
    status?: number;
    requestId?: string;
    validationIssues?: ValidationIssue[];
    cause?: unknown;
  }) {
    super(input.message, { cause: input.cause });
    this.name = "ApiError";
    this.code = input.code;
    this.status = input.status;
    this.requestId = input.requestId;
    this.validationIssues = input.validationIssues ?? [];
  }
}

export function apiErrorCode(status: number): ApiErrorCode {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 422 || status === 400) return "VALIDATION_ERROR";
  if (status >= 500) return "SERVER_ERROR";
  return "HTTP_ERROR";
}

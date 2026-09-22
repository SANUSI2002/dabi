import { apiBaseUrl } from "@/config/runtime";
import { ApiError, apiErrorCode, type ValidationIssue } from "./errors";

export type AccessTokenProvider = () => string | undefined | Promise<string | undefined>;
export type RefreshHandler = () => boolean | Promise<boolean>;
export type UnauthorizedHandler = () => void;

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  timeoutMs?: number;
  authenticated?: boolean;
  retryAfterRefresh?: boolean;
};

type ErrorEnvelope = {
  message?: string;
  error?: { message?: string; code?: string; details?: ValidationIssue[] };
  errors?: ValidationIssue[];
  requestId?: string;
  correlationId?: string;
};

export class ApiClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private accessToken?: AccessTokenProvider;
  private refresh?: RefreshHandler;
  private onUnauthorized?: UnauthorizedHandler;

  constructor(baseUrl: string, timeoutMs = 15_000) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.timeoutMs = timeoutMs;
  }

  configureAuth(input: { accessToken: AccessTokenProvider; refresh?: RefreshHandler; onUnauthorized?: UnauthorizedHandler }) {
    this.accessToken = input.accessToken;
    this.refresh = input.refresh;
    this.onUnauthorized = input.onUnauthorized;
  }

  get<T>(path: string, options: ApiRequestOptions = {}) { return this.request<T>(path, { ...options, method: "GET" }); }
  post<T>(path: string, body?: unknown, options: ApiRequestOptions = {}) { return this.request<T>(path, { ...options, method: "POST", body }); }
  put<T>(path: string, body?: unknown, options: ApiRequestOptions = {}) { return this.request<T>(path, { ...options, method: "PUT", body }); }
  patch<T>(path: string, body?: unknown, options: ApiRequestOptions = {}) { return this.request<T>(path, { ...options, method: "PATCH", body }); }
  delete<T>(path: string, options: ApiRequestOptions = {}) { return this.request<T>(path, { ...options, method: "DELETE" }); }

  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    if (!this.baseUrl) {
      throw new ApiError({
        code: "SERVICE_UNAVAILABLE",
        message: "This service is not connected yet. No data was changed.",
      });
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? this.timeoutMs);
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");
    if (options.body !== undefined && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
    if (options.authenticated !== false && this.accessToken) {
      const token = await this.accessToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
    }

    try {
      const response = await fetch(`${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`, {
        ...options,
        headers,
        credentials: "include",
        signal: controller.signal,
        body: options.body === undefined || options.body instanceof FormData ? options.body : JSON.stringify(options.body),
      });

      if (response.status === 401 && options.retryAfterRefresh !== false && this.refresh && await this.refresh()) {
        return this.request<T>(path, { ...options, retryAfterRefresh: false });
      }
      if (response.status === 401) this.onUnauthorized?.();
      if (!response.ok) throw await this.toError(response);
      if (response.status === 204) return undefined as T;
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new ApiError({ code: "INVALID_RESPONSE", status: response.status, message: "The server returned an unsupported response." });
      }
      return await response.json() as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ApiError({ code: "TIMEOUT", message: "The request timed out. Please try again.", cause: error });
      }
      throw new ApiError({ code: "NETWORK_ERROR", message: "The service could not be reached. Please check your connection and try again.", cause: error });
    } finally {
      window.clearTimeout(timeout);
    }
  }

  private async toError(response: Response) {
    const payload = await response.json().catch(() => ({})) as ErrorEnvelope;
    const validationIssues = payload.errors ?? payload.error?.details ?? [];
    return new ApiError({
      code: apiErrorCode(response.status),
      status: response.status,
      requestId: response.headers.get("x-request-id") ?? payload.requestId ?? payload.correlationId,
      validationIssues,
      message: payload.error?.message ?? payload.message ?? this.defaultMessage(response.status),
    });
  }

  private defaultMessage(status: number) {
    if (status === 401) return "Your session has expired. Please sign in again.";
    if (status === 403) return "You do not have permission to perform this action.";
    if (status === 404) return "The requested record could not be found.";
    if (status === 422 || status === 400) return "Some submitted information is invalid.";
    if (status >= 500) return "The service is temporarily unavailable. Please try again later.";
    return `The request failed with status ${status}.`;
  }
}

export const apiClient = new ApiClient(apiBaseUrl);

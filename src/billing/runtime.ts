import { HttpRevenueCycleApi, type RevenueCycleApi } from "./api";
import { LocalRevenueCycleApi } from "./localApi";

export type RevenueCycleMode = "local" | "api";
export type AccessTokenProvider = () => Promise<string>;

const requestedMode = import.meta.env.VITE_REVENUE_CYCLE_MODE;
export const revenueCycleMode: RevenueCycleMode = requestedMode === "api" ? "api" : "local";
export const revenueCycleApiBaseUrl = (import.meta.env.VITE_REVENUE_CYCLE_API_URL || "").replace(/\/$/, "");

const localApi = new LocalRevenueCycleApi();
let httpApi: HttpRevenueCycleApi | undefined;

/** Must be called after authentication and before any API-mode billing command. */
export function configureRevenueCycleHttp(accessToken: AccessTokenProvider, baseUrl = revenueCycleApiBaseUrl) {
  if (!baseUrl) throw new Error("VITE_REVENUE_CYCLE_API_URL is required when revenue-cycle mode is api.");
  httpApi = new HttpRevenueCycleApi(baseUrl, accessToken);
  return httpApi;
}

export function getRevenueCycleApi(): RevenueCycleApi {
  if (revenueCycleMode === "local") return localApi;
  if (!httpApi) throw new Error("Revenue-cycle API mode is not configured with an authenticated token provider.");
  return httpApi;
}

export const revenueCycleRuntime = {
  mode: revenueCycleMode,
  api: getRevenueCycleApi,
  configureHttp: configureRevenueCycleHttp,
};

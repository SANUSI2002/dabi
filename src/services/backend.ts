import { apiClient } from "@/api/client";
import type { AuthService, SubscriptionCheckoutService } from "./contracts";

export const authService: AuthService = {
  login: (input) => apiClient.post("/api/auth/login", input, { authenticated: false }),
  refresh: (refreshToken) => apiClient.post("/api/auth/refresh", { refreshToken }, { authenticated: false, retryAfterRefresh: false }),
  logout: (refreshToken) => apiClient.post("/api/auth/logout", { refreshToken }),
  me: async () => (await apiClient.get<{ user: Awaited<ReturnType<AuthService["me"]>> }>("/api/auth/me")).user,
};

/** BACKEND REQUIRED: checkout creation never activates a subscription client-side. */
export const subscriptionCheckoutService: SubscriptionCheckoutService = {
  createCheckout: (input) => apiClient.post("/api/v1/subscription-checkouts", input),
  getCheckout: (checkoutId) => apiClient.get(`/api/v1/subscription-checkouts/${encodeURIComponent(checkoutId)}`),
};

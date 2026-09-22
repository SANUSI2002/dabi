import type { ApiClient } from "@/api/client";

export type ListResult<T> = { items: T[]; nextCursor?: string; total?: number };
export type ServiceContext = { api: ApiClient };

export type BackendResourceService<T, CreateInput, UpdateInput = Partial<CreateInput>> = {
  list(params?: Record<string, string | number | boolean | undefined>): Promise<ListResult<T>>;
  get(id: string): Promise<T>;
  create(input: CreateInput): Promise<T>;
  update(id: string, input: UpdateInput): Promise<T>;
};

export type AuthSession = {
  accessToken: string;
  refreshToken?: string;
  user: { id: string; email: string; roles: string[]; organizationIds?: string[] };
};

export type AuthService = {
  login(input: { email: string; password: string }): Promise<AuthSession>;
  refresh(refreshToken: string): Promise<Pick<AuthSession, "accessToken">>;
  logout(refreshToken?: string): Promise<void>;
  me(): Promise<AuthSession["user"]>;
};

export type PackageSelection = {
  packageId: string;
  packageCode: string;
  billingCycle: "Monthly" | "Annual";
  selectedAt: string;
};

export type SubscriptionCheckoutService = {
  createCheckout(input: {
    applicationId: string;
    packageVersionId: string;
    billingCycle: "Monthly" | "Annual";
    organizationId?: string;
  }): Promise<{ checkoutId: string; status: "PENDING"; paymentUrl?: string }>;
  getCheckout(checkoutId: string): Promise<{ checkoutId: string; status: "PENDING" | "PAID" | "FAILED" | "EXPIRED" }>;
};

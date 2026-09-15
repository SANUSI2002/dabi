import { create } from "zustand";
import { DEFAULT_TENANT, readActiveTenant, writeActiveTenant, type TenantContext } from "@/platform/tenantRuntime";

type TenantState = {
  tenant: TenantContext;
  setTenant: (tenant: TenantContext) => void;
};

export const useTenant = create<TenantState>((set) => ({
  tenant: readActiveTenant(),
  setTenant: (tenant) => {
    writeActiveTenant(tenant);
    set({ tenant });
  },
}));

export const currentTenant = () => useTenant.getState().tenant ?? DEFAULT_TENANT;

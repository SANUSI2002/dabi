export const DEFAULT_TENANT_ID = "org-sabi";
const ACTIVE_TENANT_KEY = "sabi-emr-active-tenant";

export type TenantContext = {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  facilityCode: string;
  country: string;
  state: string;
  timezone: string;
  locale: string;
  currency: string;
  status: string;
};

export const DEFAULT_TENANT: TenantContext = {
  id: DEFAULT_TENANT_ID,
  tenantId: "TEN-0001",
  name: "Sabi Health Post",
  slug: "sabi-health",
  facilityCode: "PHC-SABI-014",
  country: "Nigeria",
  state: "Lagos",
  timezone: "Africa/Lagos",
  locale: "en-NG",
  currency: "NGN",
  status: "Active",
};

export function readActiveTenant(): TenantContext {
  try {
    const raw = localStorage.getItem(ACTIVE_TENANT_KEY);
    if (!raw) return DEFAULT_TENANT;
    const parsed = JSON.parse(raw) as Partial<TenantContext>;
    if (!parsed.id || !parsed.tenantId || !parsed.name) return DEFAULT_TENANT;
    return { ...DEFAULT_TENANT, ...parsed };
  } catch {
    return DEFAULT_TENANT;
  }
}

export function writeActiveTenant(tenant: TenantContext): void {
  try {
    localStorage.setItem(ACTIVE_TENANT_KEY, JSON.stringify(tenant));
  } catch {
    /* private mode: retain the in-memory tenant store */
  }
}

export const activeTenantId = () => readActiveTenant().id;
export const tenantStorageKey = (key: string) => `tenant:${activeTenantId()}:${key}`;

export const activeFacility = () => {
  const tenant = readActiveTenant();
  return {
    name: tenant.name,
    code: tenant.facilityCode,
    state: tenant.state,
    country: tenant.country,
    timezone: tenant.timezone,
    lga: tenant.state,
  };
};

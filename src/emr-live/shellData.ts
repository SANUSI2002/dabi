import { useTenant } from "@/store/useTenant";
import { liveRouteState } from "./routes";
import { useIsLiveEmr, useLiveEmr } from "./session";

// Shell data for live mode: the hospital shown in the sidebar/top bar, and where a live user lands.

const facilityCodeOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).map((word) => word.charAt(0).toUpperCase()).join("").slice(0, 6) || "EMR";

export type ShellTenant = { name: string; facilityCode: string; tenantId: string; location: string };

/** The hospital shown in the shell: the live hospital, or the demo tenant. */
export function useShellTenant(): ShellTenant {
  const live = useIsLiveEmr();
  const access = useLiveEmr((state) => state.access);
  const tenant = useTenant((state) => state.tenant);
  if (live && access) {
    return { name: access.organizationName, facilityCode: facilityCodeOf(access.organizationName), tenantId: access.organizationId, location: "" };
  }
  return { name: tenant.name, facilityCode: tenant.facilityCode, tenantId: tenant.tenantId, location: [tenant.state, tenant.country].filter(Boolean).join(", ") };
}

/** Where a live user lands in the EMR: the first connected screen their role can open. */
export function liveLandingRoute(permissions: readonly string[]) {
  return ["/queue", "/registration"].find((path) => liveRouteState(path, permissions) === "connected") ?? "/workspace";
}

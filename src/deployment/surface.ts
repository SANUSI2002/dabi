export type DeploymentSurface = "all" | "health" | "emr" | "pharmacy" | "command-center" | "telemedicine";

const publicPrefixes = ["/products/", "/solutions/", "/resources", "/register", "/signup/organisation", "/signup/organization"];
const publicPaths = new Set(["/", "/access", "/ai", "/roadmap", "/security", "/about", "/pricing", "/book-demo"]);
const sharedAuthPaths = new Set(["/login", "/mfa", "/choose-organization", "/forgot-password", "/sso", "/account/sessions", "/accept-invite"]);

export function deploymentSurface(value: string | undefined): DeploymentSurface {
  return value === "health" || value === "emr" || value === "pharmacy" || value === "command-center" || value === "telemedicine" ? value : "all";
}

export function surfaceForPath(pathname: string): Exclude<DeploymentSurface, "all"> | "shared" {
  if (pathname.startsWith("/reset-password/")) return "shared";
  if (pathname.startsWith("/pharmacy/") || pathname.startsWith("/pharmacy-portal")) return "pharmacy";
  if (pathname === "/telemedicine" || pathname.startsWith("/telemedicine/")) return "telemedicine";
  if (pathname === "/command-center" || pathname.startsWith("/command-center/")) return "command-center";
  if (publicPaths.has(pathname) || publicPrefixes.some((prefix) => pathname.startsWith(prefix))) return "health";
  if (sharedAuthPaths.has(pathname)) return "shared";
  return "emr";
}

export function otherSurfaceUrl(pathname: string, search: string, current: DeploymentSurface, origins: { health?: string; emr?: string; pharmacy?: string; "command-center"?: string; telemedicine?: string }): string | null {
  if (current === "all") return null;
  if (pathname === "/" && current !== "health") return null;
  const target = surfaceForPath(pathname);
  if (target === "shared" || target === current) return null;
  const origin = origins[target]?.trim();
  if (!origin || !/^https?:\/\//i.test(origin)) return null;
  const targetPath = target === "telemedicine" ? pathname.replace(/^\/telemedicine(?=\/|$)/, "") || "/" : pathname;
  return new URL(`${targetPath}${search}`, `${origin.replace(/\/$/, "")}/`).toString();
}

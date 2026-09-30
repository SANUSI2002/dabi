import { moduleForRoute } from "@/platform/entitlements";

// Which EMR screens read and write the live hospital backend. Every other screen shows a
// "not connected yet" notice in live mode, so demo records are never shown as a hospital's data.
// Each entry names the permission the backend requires to read that screen's data.
export const LIVE_CONNECTED_ROUTES: Record<string, string> = {
  "/registration": "patient.read",
  "/queue": "queue.read",
  // The consultation room is for clinicians who diagnose (doctors), not every queue user.
  "/consultation": "diagnosis.record",
  "/laboratory": "lab.order.read",
  // The pharmacy queue is for pharmacy staff (the backend allows reviewers and dispensers).
  "/pharmacy": "prescription.dispense",
};

export type LiveRouteState = "connected" | "no-permission" | "not-connected";

export function liveRouteState(path: string, permissions: readonly string[]): LiveRouteState {
  const permission = LIVE_CONNECTED_ROUTES[path];
  if (!permission) return "not-connected";
  return permissions.includes(permission) ? "connected" : "no-permission";
}

/** Screens that belong to the EMR product — the only ones listed in a live hospital's navigation. */
export const isEmrRoute = (path: string) => moduleForRoute(path)?.product === "emr";

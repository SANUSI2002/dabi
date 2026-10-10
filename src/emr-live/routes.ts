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
  "/inpatient": "admission.read",
  // The billing desk (cashiers and finance); its invoice pages live under /billing/invoices/:id.
  "/billing": "billing.read",
};

export type LiveRouteState = "connected" | "no-permission" | "not-connected";

/** The connected screen a path belongs to: the screen itself or one of its sub-pages (/billing/invoices/…). */
const connectedScreen = (path: string) => (LIVE_CONNECTED_ROUTES[path] ? path : Object.keys(LIVE_CONNECTED_ROUTES).find((screen) => path.startsWith(`${screen}/`)));

export function liveRouteState(path: string, permissions: readonly string[]): LiveRouteState {
  const screen = connectedScreen(path);
  const permission = screen ? LIVE_CONNECTED_ROUTES[screen] : undefined;
  if (!permission) return "not-connected";
  return permissions.includes(permission) ? "connected" : "no-permission";
}

/** Screens that belong to the EMR product — the only ones listed in a live hospital's navigation. */
export const isEmrRoute = (path: string) => moduleForRoute(path)?.product === "emr";

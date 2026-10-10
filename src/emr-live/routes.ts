// Which EMR screens read and write the live hospital backend. Every other screen shows a
// "not connected yet" notice in live mode, so demo records are never shown as a hospital's data.
// Each entry names the permission the backend requires to read that screen's data (any one of a list).
export const LIVE_CONNECTED_ROUTES: Record<string, string | readonly string[]> = {
  // The home dashboard summarises the other screens; each part checks its own permission.
  "/workspace": ["queue.read", "patient.read", "lab.order.read", "prescription.read", "emr.stock.view", "billing.read", "admission.read"],
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
  // The patient chart (/patients/:id) and Medical History are clinical records (doctors, nurses).
  "/patients": "clinical.read",
  "/history": "clinical.read",
  "/appointments": "appointment.read",
  "/radiology": "imaging.read",
};

export type LiveRouteState = "connected" | "no-permission" | "not-connected";

/** The connected screen a path belongs to: the screen itself or one of its sub-pages (/billing/invoices/…). */
const connectedScreen = (path: string) => (LIVE_CONNECTED_ROUTES[path] ? path : Object.keys(LIVE_CONNECTED_ROUTES).find((screen) => path.startsWith(`${screen}/`)));

export function liveRouteState(path: string, permissions: readonly string[]): LiveRouteState {
  const screen = connectedScreen(path);
  const required = screen ? LIVE_CONNECTED_ROUTES[screen] : undefined;
  if (!required) return "not-connected";
  return [required].flat().some((permission) => permissions.includes(permission)) ? "connected" : "no-permission";
}

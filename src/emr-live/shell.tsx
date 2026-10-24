import { useEffect, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { Lock, PlugZap, PowerOff } from "lucide-react";
import { EmrRouteLoadingScreen } from "@/components/layout/AppLoadingScreen";
import { LIVE_CONNECTED_ROUTES, liveRouteState } from "./routes";
import { useLiveEmr } from "./session";
import { LiveWorkforceSync } from "@/workforce-live/LiveWorkforceSync";
import { useLiveModulesMeta } from "@/workforce-live/modules";
import { useEntitlements } from "@/platform/useEntitlements";

// The EMR shell (sidebar, top bar, route boundary) in live mode: the hospital, user and permissions
// come from the verified live session; demo mode keeps the local tenant exactly as before.

const NO_PERMISSIONS: readonly string[] = [];

/**
 * Opens the EMR shell for a live sign-in once the hospital is re-verified (e.g. after a reload).
 * Without a verified hospital the user goes back to their Sabi ID account to choose one.
 */
export function LiveWorkspaceGate({ children }: { children: ReactNode }) {
  const status = useLiveEmr((state) => state.status);
  useEffect(() => { void useLiveEmr.getState().restore(); }, []);
  if (status === "ready") return <><LiveWorkforceSync />{children}</>;
  if (status === "error") return <Navigate to="/identity/account" replace />;
  return <EmrRouteLoadingScreen pathname="/workspace" tenantName="your hospital" />;
}

/** Live-mode route boundary: connected screens render; every other screen says so plainly. */
export function LiveRouteBoundary({ pathname, children }: { pathname: string; children: ReactNode }) {
  const permissions = useLiveEmr((state) => state.access?.permissions ?? NO_PERMISSIONS);
  const organizationName = useLiveEmr((state) => state.access?.organizationName ?? "your hospital");
  const state = liveRouteState(pathname, permissions);
  // The organization's module switches (within its package) — the server refuses a switched-off module too.
  const modulesLoaded = useLiveModulesMeta((s) => s.loaded);
  useEntitlements((s) => s.products); useEntitlements((s) => s.modules); useEntitlements((s) => s.submodules);
  const off = modulesLoaded ? useEntitlements.getState().routeBlockReason(pathname) : null;
  if (off) return <SwitchedOff organizationName={organizationName} reason={off} />;
  if (state === "connected") return <>{children}</>;

  const labels: Record<string, string> = { "/registration": "Registration", "/queue": "Clinical Queue", "/consultation": "Consultation", "/laboratory": "Laboratory", "/pharmacy": "Pharmacy", "/inpatient": "In-patient Care", "/billing": "Billing", "/history": "Medical History", "/workspace": "Workspace", "/appointments": "Appointments", "/radiology": "Radiology", "/procedures": "Procedures" };
  // Screens with a page of their own (the patient chart opens from a patient, not from here).
  const connected = Object.keys(LIVE_CONNECTED_ROUTES).filter((path) => labels[path] && liveRouteState(path, permissions) === "connected");
  const Icon = state === "no-permission" ? Lock : PlugZap;
  return (
    <div className="grid place-items-center py-24">
      <div className="max-w-md rounded-2xl border border-dashed border-mist-300 bg-mist-50/60 p-8 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-mist-200 text-mist-500">
          <Icon size={22} />
        </div>
        <h2 className="font-display text-lg font-bold text-mist-800">
          {state === "no-permission" ? "Not available for your role" : "Not connected yet"}
        </h2>
        <p className="mt-1.5 text-sm text-mist-500">
          {state === "no-permission"
            ? `Your role at ${organizationName} does not include this screen. Ask your hospital administrator if you need access.`
            : `This screen is not connected to ${organizationName}'s live records yet, so it shows nothing rather than sample data.`}
        </p>
        {connected.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {connected.map((path) => (
              <Link key={path} to={path} className="btn-primary inline-flex">{labels[path]}</Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** A screen of a module the organization switched off, or of a product its package does not include. */
function SwitchedOff({ organizationName, reason }: { organizationName: string; reason: { product?: string; module?: string; submodule?: string } }) {
  const what = reason.product ? reason.product : reason.module ? `the ${reason.module} module` : `${reason.submodule}`;
  return (
    <div className="grid place-items-center py-24">
      <div className="max-w-md rounded-2xl border border-dashed border-mist-300 bg-mist-50/60 p-8 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-mist-200 text-mist-500"><PowerOff size={22} /></div>
        <h2 className="font-display text-lg font-bold text-mist-800">{reason.product ? "Not part of your package" : "Switched off"}</h2>
        <p className="mt-1.5 text-sm text-mist-500">
          {reason.product
            ? `${organizationName}'s approved Sabi package does not include ${what}. Contact Sabi to add it.`
            : `${organizationName} has switched off ${what}. Its records are kept; an administrator can switch it back on in Platform & Modules.`}
        </p>
        <Link to="/platform" className="btn-ghost mt-4 inline-flex">Platform &amp; Modules</Link>
      </div>
    </div>
  );
}

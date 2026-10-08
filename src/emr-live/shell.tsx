import { useEffect, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { Lock, PlugZap } from "lucide-react";
import { EmrRouteLoadingScreen } from "@/components/layout/AppLoadingScreen";
import { LIVE_CONNECTED_ROUTES, liveRouteState } from "./routes";
import { useLiveEmr } from "./session";

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
  if (status === "ready") return <>{children}</>;
  if (status === "error") return <Navigate to="/identity/account" replace />;
  return <EmrRouteLoadingScreen pathname="/workspace" tenantName="your hospital" />;
}

/** Live-mode route boundary: connected screens render; every other screen says so plainly. */
export function LiveRouteBoundary({ pathname, children }: { pathname: string; children: ReactNode }) {
  const permissions = useLiveEmr((state) => state.access?.permissions ?? NO_PERMISSIONS);
  const organizationName = useLiveEmr((state) => state.access?.organizationName ?? "your hospital");
  const state = liveRouteState(pathname, permissions);
  if (state === "connected") return <>{children}</>;

  const connected = Object.keys(LIVE_CONNECTED_ROUTES).filter((path) => liveRouteState(path, permissions) === "connected");
  const labels: Record<string, string> = { "/registration": "Registration", "/queue": "Clinical Queue", "/consultation": "Consultation", "/laboratory": "Laboratory", "/pharmacy": "Pharmacy", "/inpatient": "In-patient Care" };
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

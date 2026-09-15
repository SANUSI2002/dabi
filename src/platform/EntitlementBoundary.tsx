import { type ReactNode } from "react";
import { useLocation, Link } from "react-router-dom";
import { Lock, ArrowRight } from "lucide-react";
import { useRouteGate } from "./useEntitlements";

// The client-side entitlement gate. Wraps the routed content; if the current
// path belongs to a module/product the org has not licensed, the real page is
// never mounted — a "not licensed" screen renders instead. This mirrors what an
// API gateway would do: a disabled module is not reachable just by knowing its
// URL.

export function EntitlementBoundary({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const gate = useRouteGate();
  const allowed = gate.isRouteAllowed(loc.pathname);
  const reason = gate.routeBlockReason(loc.pathname);

  if (gate.accessMode === "blocked") {
    return (
      <div className="grid place-items-center py-24">
        <div className="max-w-lg rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-card">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-amber-100 text-amber-700">
            <Lock size={22} />
          </div>
          <h2 className="font-display text-xl font-bold text-mist-900">Subscription inactive</h2>
          <p className="mt-2 text-sm leading-6 text-mist-500">
            Your organization&apos;s Sabi OS subscription is currently {gate.subscriptionStatus.toLowerCase()}.
            Your data has not been removed. Contact your organization administrator or Sabi Support to restore access.
          </p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-mist-400">
            License status: {gate.licenseStatus}
          </p>
        </div>
      </div>
    );
  }

  if (allowed) return (
    <>
      {gate.accessMode === "read-only" && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Grace-period access is active. This frontend exposes the policy state; production write APIs must enforce read-only access.
        </div>
      )}
      {children}
    </>
  );

  const what = reason?.product
    ? `the ${reason.product} product`
    : reason?.module
      ? `the “${reason.module}” module`
      : reason?.submodule
        ? `the “${reason.submodule}” feature`
        : "this area";

  return (
    <div className="grid place-items-center py-24">
      <div className="max-w-md rounded-2xl border border-dashed border-mist-300 bg-mist-50/60 p-8 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-mist-200 text-mist-500">
          <Lock size={22} />
        </div>
        <h2 className="font-display text-lg font-bold text-mist-800">Not part of your plan</h2>
        <p className="mt-1.5 text-sm text-mist-500">
          This organisation has not licensed {what}. Ask an administrator to enable it from the Platform &amp; Modules
          settings, or contact Sabi to add it to your subscription.
        </p>
        <Link to="/platform" className="btn-primary mt-4 inline-flex">
          Manage modules <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}

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

  if (allowed) return <>{children}</>;

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

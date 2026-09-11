import { FlaskConical, Cable, Ban } from "lucide-react";
import type { IntegrationKind } from "@/data/equipment";

// Mandatory, explicit disclosure of what a device connection actually is — never let a
// simulated feed be mistaken for a real hospital device connection (directive rule 40).
export function IntegrationBadge({ kind }: { kind: IntegrationKind }) {
  if (kind === "SIMULATOR") {
    return (
      <span className="chip gap-1 bg-amber-50 text-amber-700 ring-1 ring-amber-200">
        <FlaskConical size={11} aria-hidden /> Simulation
      </span>
    );
  }
  if (kind === "REAL_DEVICE") {
    return (
      <span className="chip gap-1 bg-brand-50 text-brand-700 ring-1 ring-brand-200">
        <Cable size={11} aria-hidden /> Real Device
      </span>
    );
  }
  return (
    <span className="chip gap-1 bg-mist-100 text-mist-600 ring-1 ring-mist-200">
      <Ban size={11} aria-hidden /> Integration Not Configured
    </span>
  );
}

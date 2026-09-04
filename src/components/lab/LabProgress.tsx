import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/format";
import type { LabOrder } from "@/data/types";

/** Sample collection + each configured phase + final sign-off, in order. */
export function labSteps(phases: string[]) {
  return ["Sample collected", ...phases, "Approved"];
}

function completedCount(order: LabOrder, phases: string[]) {
  if (order.status === "Pending") return 0;
  if (order.status === "Sample Collected") return 1;
  if (order.status === "In Process") return 1 + (order.phaseIndex ?? 0);
  if (order.status === "Awaiting Approval") return 1 + phases.length;
  if (order.status === "Resulted") return 1 + phases.length + 1;
  return 0;
}

export function labStatusLine(order: LabOrder, phases: string[]) {
  if (order.status === "Pending") return "Awaiting sample collection";
  if (order.status === "Sample Collected") return `Sample collected${order.sampleCollectedBy ? ` by ${order.sampleCollectedBy}` : ""}${order.sampleType ? ` (${order.sampleType})` : ""} — not yet started`;
  if (order.status === "In Process") {
    const i = order.phaseIndex ?? 0;
    return `Phase ${i + 1} of ${phases.length}: ${phases[i] ?? phases[phases.length - 1]}`;
  }
  if (order.status === "Awaiting Approval") return `Result submitted by ${order.submittedBy} — awaiting sign-off`;
  if (order.status === "Resulted") return `Approved by ${order.approvedBy} · ${order.approvedAt ? timeAgo(order.approvedAt) : ""}`;
  if (order.status === "Rejected") return "Order rejected";
  return "";
}

export function LabProgress({ order, phases }: { order: LabOrder; phases: string[] }) {
  if (order.status === "Rejected") {
    return (
      <div className="flex items-center gap-2 text-sm text-action-600">
        <X size={15} /> Rejected
      </div>
    );
  }

  const steps = labSteps(phases);
  const done = completedCount(order, phases);
  const isFullyApproved = order.status === "Resulted";

  return (
    <div>
      <div className="flex items-center gap-1">
        {steps.map((label, i) => {
          const complete = i < done;
          const current = i === done && !isFullyApproved;
          return (
            <div key={label} className="flex flex-1 items-center gap-1">
              <div
                title={label}
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                  complete ? "bg-brand-gradient text-white" : current ? "bg-amber-400 text-white animate-pulse" : "bg-mist-100 text-mist-400",
                )}
              >
                {complete ? <Check size={13} /> : i + 1}
              </div>
              {i < steps.length - 1 && <div className={cn("h-0.5 flex-1", complete ? "bg-brand-400" : "bg-mist-100")} />}
            </div>
          );
        })}
      </div>
      <p className={cn("mt-1.5 text-[11px]", isFullyApproved ? "font-semibold text-brand-600" : "text-mist-400")}>
        {labStatusLine(order, phases)}
      </p>
    </div>
  );
}

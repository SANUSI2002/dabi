import { type ReactNode } from "react";
import {
  Power, PowerOff, Loader2, CircleCheck, CircleDot, TriangleAlert, CircleX, Skull,
  Wrench, Gauge, Ban, Wifi, WifiOff, HelpCircle, Send, ShieldCheck, ShieldAlert,
  BellRing, Eye, ArrowUpCircle, Check, XCircle, VolumeX,
} from "lucide-react";
import type { MachineState, ConnectivityState, MaintenanceState, SafetyState } from "@/data/equipmentState";
import type { AlarmSeverity, AlarmLifecycle } from "@/data/equipmentAlarms";

type Tone = "brand" | "action" | "mist" | "amber";
type Entry = { label: string; tone: Tone; icon: ReactNode };

const MACHINE: Record<MachineState, Entry> = {
  Unknown: { label: "Unknown", tone: "mist", icon: <HelpCircle size={11} aria-hidden /> },
  Offline: { label: "Offline", tone: "mist", icon: <PowerOff size={11} aria-hidden /> },
  "Powered Off": { label: "Powered Off", tone: "mist", icon: <PowerOff size={11} aria-hidden /> },
  Starting: { label: "Starting", tone: "amber", icon: <Loader2 size={11} className="animate-spin" aria-hidden /> },
  Ready: { label: "Ready", tone: "brand", icon: <CircleCheck size={11} aria-hidden /> },
  Idle: { label: "Idle", tone: "mist", icon: <CircleDot size={11} aria-hidden /> },
  Running: { label: "Running", tone: "brand", icon: <Power size={11} aria-hidden /> },
  Warning: { label: "Warning", tone: "amber", icon: <TriangleAlert size={11} aria-hidden /> },
  Error: { label: "Error", tone: "action", icon: <CircleX size={11} aria-hidden /> },
  Critical: { label: "Critical", tone: "action", icon: <Skull size={11} aria-hidden /> },
  Maintenance: { label: "Maintenance", tone: "amber", icon: <Wrench size={11} aria-hidden /> },
  Calibration: { label: "Calibration", tone: "amber", icon: <Gauge size={11} aria-hidden /> },
  Decommissioned: { label: "Decommissioned", tone: "mist", icon: <Ban size={11} aria-hidden /> },
};

const CONNECTIVITY: Record<ConnectivityState, Entry> = {
  Online: { label: "Online", tone: "brand", icon: <Wifi size={11} aria-hidden /> },
  Degraded: { label: "Degraded", tone: "amber", icon: <Wifi size={11} aria-hidden /> },
  Stale: { label: "Stale", tone: "amber", icon: <WifiOff size={11} aria-hidden /> },
  Offline: { label: "Offline", tone: "action", icon: <WifiOff size={11} aria-hidden /> },
  Unknown: { label: "Unknown", tone: "mist", icon: <HelpCircle size={11} aria-hidden /> },
};

const MAINTENANCE: Record<MaintenanceState, Entry> = {
  "Not Due": { label: "Not Due", tone: "brand", icon: <ShieldCheck size={11} aria-hidden /> },
  "Due Soon": { label: "Due Soon", tone: "amber", icon: <ShieldAlert size={11} aria-hidden /> },
  Overdue: { label: "Overdue", tone: "action", icon: <ShieldAlert size={11} aria-hidden /> },
  "In Progress": { label: "In Progress", tone: "amber", icon: <Wrench size={11} aria-hidden /> },
};

const SAFETY: Record<SafetyState, Entry> = {
  Normal: { label: "Normal", tone: "brand", icon: <ShieldCheck size={11} aria-hidden /> },
  Warning: { label: "Warning", tone: "amber", icon: <TriangleAlert size={11} aria-hidden /> },
  Critical: { label: "Critical", tone: "action", icon: <ShieldAlert size={11} aria-hidden /> },
};

const SEVERITY: Record<AlarmSeverity, Entry> = {
  Informational: { label: "Informational", tone: "mist", icon: <CircleDot size={11} aria-hidden /> },
  Low: { label: "Low", tone: "mist", icon: <CircleDot size={11} aria-hidden /> },
  Medium: { label: "Medium", tone: "amber", icon: <TriangleAlert size={11} aria-hidden /> },
  High: { label: "High", tone: "amber", icon: <TriangleAlert size={11} aria-hidden /> },
  Critical: { label: "Critical", tone: "action", icon: <ShieldAlert size={11} aria-hidden /> },
  Emergency: { label: "Emergency", tone: "action", icon: <Skull size={11} aria-hidden /> },
};

const ALARM_LIFECYCLE: Record<AlarmLifecycle, Entry> = {
  Raised: { label: "Raised", tone: "action", icon: <BellRing size={11} aria-hidden /> },
  Acknowledged: { label: "Acknowledged", tone: "amber", icon: <Eye size={11} aria-hidden /> },
  Investigating: { label: "Investigating", tone: "amber", icon: <Send size={11} aria-hidden /> },
  Escalated: { label: "Escalated", tone: "action", icon: <ArrowUpCircle size={11} aria-hidden /> },
  Resolved: { label: "Resolved", tone: "brand", icon: <Check size={11} aria-hidden /> },
  Closed: { label: "Closed", tone: "mist", icon: <XCircle size={11} aria-hidden /> },
  Suppressed: { label: "Suppressed", tone: "mist", icon: <VolumeX size={11} aria-hidden /> },
};

const TONE_CLASS: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-700 ring-1 ring-brand-200",
  action: "bg-action-50 text-action-700 ring-1 ring-action-200",
  mist: "bg-mist-100 text-mist-600 ring-1 ring-mist-200",
  amber: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
};

function render(entry: Entry) {
  return (
    <span className={`chip gap-1 ${TONE_CLASS[entry.tone]}`}>
      {entry.icon}
      {entry.label}
    </span>
  );
}

export function MachineStateBadge({ state }: { state: MachineState }) { return render(MACHINE[state]); }
export function ConnectivityBadge({ state }: { state: ConnectivityState }) { return render(CONNECTIVITY[state]); }
export function MaintenanceStateBadge({ state }: { state: MaintenanceState }) { return render(MAINTENANCE[state]); }
export function SafetyStateBadge({ state }: { state: SafetyState }) { return render(SAFETY[state]); }
export function AlarmSeverityBadge({ severity }: { severity: AlarmSeverity }) { return render(SEVERITY[severity]); }
export function AlarmLifecycleBadge({ status }: { status: AlarmLifecycle }) { return render(ALARM_LIFECYCLE[status]); }

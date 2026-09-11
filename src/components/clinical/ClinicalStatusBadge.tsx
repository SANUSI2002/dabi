import { type ReactNode } from "react";
import {
  CircleDot, Clock, CircleCheck, CircleX, TriangleAlert, Ban, Send, Beaker,
  ClipboardCheck, FileText, Truck, Pencil, Eye, BellRing, RotateCcw, PauseCircle,
} from "lucide-react";
import { cn } from "@/lib/cn";

// A shared clinical-status vocabulary. The point is to keep these concepts
// visibly SEPARATE rather than collapsing everything into one "status":
//
//   request  — an ORDER / REQUEST was placed (ServiceRequest / MedicationRequest)
//   task     — a unit of WORK someone must do (Task)
//   service  — a PERFORMED SERVICE / procedure (Procedure)
//   result   — a RESULT / report and its verification (DiagnosticReport / Observation)
//   note     — a clinical document and its signature lifecycle (DocumentReference)
//   dispense — pharmacy dispensing (MedicationDispense)
//   admin    — inpatient medication administration (MedicationAdministration)
//   referral — a referral / transfer of care
//   comm     — how a result was communicated to the responsible clinician
//
// Every badge shows an icon AND text, so meaning never depends on colour alone.

type Tone = "brand" | "action" | "mist" | "amber";
type Entry = { label: string; tone: Tone; icon: ReactNode };

const dot = <CircleDot size={11} aria-hidden />;
const clock = <Clock size={11} aria-hidden />;
const check = <CircleCheck size={11} aria-hidden />;
const cross = <CircleX size={11} aria-hidden />;
const warn = <TriangleAlert size={11} aria-hidden />;
const ban = <Ban size={11} aria-hidden />;

export type ClinicalStatusKind =
  | "request" | "task" | "service" | "result" | "note" | "dispense" | "admin" | "referral" | "comm";

const MAPS: Record<ClinicalStatusKind, Record<string, Entry>> = {
  request: {
    draft: { label: "Draft order", tone: "mist", icon: <Pencil size={11} aria-hidden /> },
    requested: { label: "Ordered", tone: "amber", icon: <Send size={11} aria-hidden /> },
    active: { label: "Active", tone: "amber", icon: dot },
    "on-hold": { label: "On hold", tone: "mist", icon: <PauseCircle size={11} aria-hidden /> },
    completed: { label: "Order completed", tone: "brand", icon: check },
    revoked: { label: "Order cancelled", tone: "mist", icon: ban },
  },
  task: {
    ready: { label: "To do", tone: "amber", icon: dot },
    requested: { label: "Requested", tone: "amber", icon: dot },
    "in-progress": { label: "In progress", tone: "amber", icon: clock },
    "on-hold": { label: "On hold", tone: "mist", icon: <PauseCircle size={11} aria-hidden /> },
    completed: { label: "Done", tone: "brand", icon: check },
    cancelled: { label: "Cancelled", tone: "mist", icon: ban },
    failed: { label: "Not done", tone: "action", icon: cross },
    overdue: { label: "Overdue", tone: "action", icon: warn },
  },
  service: {
    "not-done": { label: "Not performed", tone: "mist", icon: dot },
    preparation: { label: "Pre-procedure", tone: "amber", icon: clock },
    "in-progress": { label: "In progress", tone: "amber", icon: clock },
    completed: { label: "Performed", tone: "brand", icon: <ClipboardCheck size={11} aria-hidden /> },
    "entered-in-error": { label: "Entered in error", tone: "action", icon: cross },
    "stopped": { label: "Stopped", tone: "action", icon: ban },
  },
  result: {
    registered: { label: "Awaiting result", tone: "amber", icon: clock },
    partial: { label: "Preliminary", tone: "amber", icon: <Beaker size={11} aria-hidden /> },
    preliminary: { label: "Preliminary", tone: "amber", icon: <Beaker size={11} aria-hidden /> },
    final: { label: "Verified result", tone: "brand", icon: check },
    amended: { label: "Amended result", tone: "amber", icon: <RotateCcw size={11} aria-hidden /> },
    corrected: { label: "Corrected result", tone: "amber", icon: <RotateCcw size={11} aria-hidden /> },
    cancelled: { label: "Cancelled", tone: "mist", icon: ban },
    "entered-in-error": { label: "Entered in error", tone: "action", icon: cross },
    critical: { label: "Critical result", tone: "action", icon: warn },
  },
  note: {
    draft: { label: "Draft", tone: "mist", icon: <Pencil size={11} aria-hidden /> },
    saved: { label: "Saved (unsigned)", tone: "amber", icon: <FileText size={11} aria-hidden /> },
    signed: { label: "Signed", tone: "brand", icon: check },
    amended: { label: "Amended", tone: "amber", icon: <RotateCcw size={11} aria-hidden /> },
    cancelled: { label: "Cancelled", tone: "mist", icon: ban },
  },
  dispense: {
    ordered: { label: "Ordered", tone: "amber", icon: <Send size={11} aria-hidden /> },
    preparation: { label: "Preparing", tone: "amber", icon: clock },
    "in-progress": { label: "Preparing", tone: "amber", icon: clock },
    completed: { label: "Dispensed", tone: "brand", icon: <Truck size={11} aria-hidden /> },
    "partially-dispensed": { label: "Partially dispensed", tone: "amber", icon: <Truck size={11} aria-hidden /> },
    declined: { label: "Refused", tone: "action", icon: cross },
    "entered-in-error": { label: "Entered in error", tone: "action", icon: cross },
    stopped: { label: "Returned", tone: "mist", icon: <RotateCcw size={11} aria-hidden /> },
  },
  admin: {
    scheduled: { label: "Scheduled", tone: "mist", icon: clock },
    due: { label: "Due now", tone: "amber", icon: <BellRing size={11} aria-hidden /> },
    given: { label: "Given", tone: "brand", icon: check },
    completed: { label: "Given", tone: "brand", icon: check },
    held: { label: "Held", tone: "amber", icon: <PauseCircle size={11} aria-hidden /> },
    "on-hold": { label: "Held", tone: "amber", icon: <PauseCircle size={11} aria-hidden /> },
    omitted: { label: "Omitted", tone: "action", icon: cross },
    "not-done": { label: "Omitted", tone: "action", icon: cross },
    refused: { label: "Refused", tone: "action", icon: cross },
    declined: { label: "Refused", tone: "action", icon: cross },
  },
  referral: {
    draft: { label: "Draft", tone: "mist", icon: <Pencil size={11} aria-hidden /> },
    requested: { label: "Sent", tone: "amber", icon: <Send size={11} aria-hidden /> },
    accepted: { label: "Accepted", tone: "amber", icon: dot },
    active: { label: "Accepted", tone: "amber", icon: dot },
    declined: { label: "Declined", tone: "action", icon: cross },
    "on-hold": { label: "On hold", tone: "mist", icon: <PauseCircle size={11} aria-hidden /> },
    scheduled: { label: "Appointment booked", tone: "amber", icon: clock },
    attended: { label: "Attended", tone: "brand", icon: check },
    completed: { label: "Completed", tone: "brand", icon: check },
    cancelled: { label: "Cancelled", tone: "mist", icon: ban },
    revoked: { label: "Declined", tone: "action", icon: cross },
    overdue: { label: "Overdue", tone: "action", icon: warn },
  },
  comm: {
    new: { label: "New", tone: "amber", icon: dot },
    viewed: { label: "Viewed", tone: "mist", icon: <Eye size={11} aria-hidden /> },
    acknowledged: { label: "Acknowledged", tone: "brand", icon: check },
    communicated: { label: "Communicated", tone: "brand", icon: <Send size={11} aria-hidden /> },
  },
};

const TONE_CLASS: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  action: "bg-action-50 text-action-700 ring-action-200",
  mist: "bg-mist-100 text-mist-600 ring-mist-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
};

/**
 * Normalises the app's existing free-text statuses (e.g. "Sample Collected",
 * "Awaiting Approval") onto the vocabulary keys above so legacy data still
 * renders a coherent badge.
 */
export function resolveStatus(kind: ClinicalStatusKind, raw: string): Entry {
  const map = MAPS[kind];
  const key = raw.trim().toLowerCase().replace(/\s+/g, "-");
  if (map[key]) return map[key];
  const legacy: Record<string, string> = {
    pending: kind === "result" ? "registered" : "requested",
    "sample-collected": "in-progress",
    "in-process": "in-progress",
    "awaiting-approval": "preliminary",
    resulted: "final",
    rejected: kind === "result" ? "cancelled" : "failed",
    open: "requested",
    dispensed: "completed",
    outsourced: "stopped",
    referred: "revoked",
  };
  if (legacy[key] && map[legacy[key]]) return map[legacy[key]];
  return { label: raw, tone: "mist", icon: dot };
}

export function ClinicalStatusBadge({
  kind,
  status,
  className,
  title,
}: {
  kind: ClinicalStatusKind;
  status: string;
  className?: string;
  title?: string;
}) {
  const entry = resolveStatus(kind, status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
        TONE_CLASS[entry.tone],
        className,
      )}
      title={title ?? `${kind}: ${entry.label}`}
    >
      {entry.icon}
      {entry.label}
    </span>
  );
}

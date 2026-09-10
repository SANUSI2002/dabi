import { type ReactNode } from "react";
import { UserRound, Clock3, Database } from "lucide-react";
import { dateTime, timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";

// "Who recorded this, when, and where did it come from" — attached to clinical
// records so provenance is always visible. Frontend-only representation aligned
// with the FHIR Provenance concept (agent / recorded / source).

export type ProvenanceInfo = {
  /** person or device that recorded the entry */
  author?: string;
  /** ISO timestamp the entry was recorded */
  recordedAt?: string;
  /** origin of the data, e.g. "Consultation encounter", "Lab analyser", "Imported" */
  source?: string;
  /** verification / signature state, when relevant */
  verifiedBy?: string;
  verifiedAt?: string;
};

export function Provenance({
  info,
  className,
  compact = false,
}: {
  info: ProvenanceInfo;
  className?: string;
  compact?: boolean;
}) {
  const parts: { icon: ReactNode; text: string; title?: string }[] = [];
  if (info.author) parts.push({ icon: <UserRound size={12} aria-hidden />, text: info.author });
  if (info.recordedAt)
    parts.push({ icon: <Clock3 size={12} aria-hidden />, text: compact ? timeAgo(info.recordedAt) : dateTime(info.recordedAt), title: dateTime(info.recordedAt) });
  if (info.source) parts.push({ icon: <Database size={12} aria-hidden />, text: info.source });

  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-mist-400", className)}>
      {parts.map((part, index) => (
        <span key={index} className="inline-flex items-center gap-1" title={part.title}>
          {part.icon}
          {part.text}
        </span>
      ))}
      {info.verifiedBy && (
        <span className="inline-flex items-center gap-1 font-medium text-brand-600">
          verified by {info.verifiedBy}
          {info.verifiedAt ? ` · ${timeAgo(info.verifiedAt)}` : ""}
        </span>
      )}
    </div>
  );
}

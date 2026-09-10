import { CODE_SYSTEM_LABEL, isStandardised, type CodeableConcept } from "@/data/clinicalCoding";
import { cn } from "@/lib/cn";

// Renders a clinical concept so a reader can tell a standardised code from a
// plain local label. Standardised concepts show "SYSTEM code"; un-coded local
// text is shown as "local label" and never dressed up to look standardised.

export function CodedValue({
  concept,
  className,
  showLocal = true,
}: {
  concept: CodeableConcept;
  className?: string;
  showLocal?: boolean;
}) {
  const standardised = isStandardised(concept);
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5", className)}>
      <span className="font-medium text-mist-900">{concept.display}</span>
      {standardised ? (
        <span
          className="rounded bg-mist-100 px-1 py-px font-mono text-[10px] text-mist-500 ring-1 ring-mist-200"
          title={`${CODE_SYSTEM_LABEL[concept.system]}${concept.version ? ` ${concept.version}` : ""}`}
        >
          {CODE_SYSTEM_LABEL[concept.system]} {concept.code}
        </span>
      ) : (
        <span className="rounded bg-amber-50 px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200">
          local label
        </span>
      )}
      {showLocal && concept.localLabel && concept.localLabel !== concept.display && (
        <span className="text-[11px] text-mist-400">(recorded as “{concept.localLabel}”)</span>
      )}
    </span>
  );
}

/** compact inline chip variant for tables */
export function CodedChip({ concept }: { concept: CodeableConcept }) {
  const standardised = isStandardised(concept);
  return (
    <span className="inline-flex items-center gap-1" title={standardised ? `${CODE_SYSTEM_LABEL[concept.system]} ${concept.code}` : "Not standardised — local free text"}>
      {concept.display}
      <span className={cn("font-mono text-[10px]", standardised ? "text-mist-400" : "text-amber-600")}>
        {standardised ? concept.code : "local"}
      </span>
    </span>
  );
}

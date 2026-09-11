import { BookOpenCheck } from "lucide-react";
import { guidelineByKey } from "@/data/guidelines";
import { shortDate } from "@/lib/format";

// Attribution banner for a screen whose prompts follow a published guideline.
// Shows the source, title, version and effective date so a user always knows
// where the guidance comes from — and states plainly that the app does not
// implement or check the guideline.
export function GuidelineBanner({ guidelineKey, className }: { guidelineKey: string; className?: string }) {
  const guideline = guidelineByKey(guidelineKey);
  if (!guideline) return null;
  return (
    <div className={`rounded-2xl border border-mist-200 bg-mist-50/70 p-3 text-sm ${className ?? ""}`}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-semibold text-mist-800">
        <BookOpenCheck size={15} className="text-brand-600" aria-hidden />
        {guideline.title}
        <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-medium text-mist-500 ring-1 ring-mist-200">
          {guideline.source} · v{guideline.version} · effective {shortDate(guideline.effectiveDate)}
        </span>
      </p>
      <p className="mt-1 text-xs text-mist-500">{guideline.summary}</p>
      <p className="mt-1 text-[11px] text-mist-400">
        This screen follows the structure of the guideline above. It does not implement or check any clinical rule —
        clinical judgement remains with the attending clinician.
      </p>
    </div>
  );
}

import { PrintDoc, SignRow } from "./PrintFrame";
import { shortDate } from "@/lib/format";

// Renders a generated letter (from useLetters) as a printable page.
export function LetterDoc({
  open,
  onClose,
  title,
  body,
  signatories,
  reference,
  date,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
  signatories: string[];
  reference?: string;
  date?: string;
}) {
  return (
    <PrintDoc open={open} onClose={onClose} docTitle={title}>
      <div className="mb-6 flex items-start justify-between text-sm">
        <div>
          <p className="font-bold uppercase tracking-wide text-brand-700">{title}</p>
          {reference && <p className="text-xs text-mist-400">Ref: {reference}</p>}
        </div>
        <p className="text-mist-500">{shortDate(date ?? new Date().toISOString())}</p>
      </div>

      <div className="space-y-3 text-sm leading-relaxed text-mist-800">
        {body.split(/\n{2,}/).map((para, i) => (
          <p key={i} className="whitespace-pre-line">{para}</p>
        ))}
      </div>

      <div className="mt-10">
        <SignRow roles={signatories} />
      </div>
    </PrintDoc>
  );
}

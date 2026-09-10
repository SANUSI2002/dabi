import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/form";
import { downloadCsv, toCsv, parseCsvObjects } from "@/lib/csv";

export function ExportButton({ filename, headers, rows, label = "Export CSV" }: { filename: string; headers: string[]; rows: (string | number | null | undefined)[][]; label?: string }) {
  return (
    <Button variant="soft" onClick={() => downloadCsv(filename, toCsv(headers, rows))}><Download size={14} /> {label}</Button>
  );
}

export function ImportButton({ title, sample, onImport }: { title: string; sample: string; onImport: (rows: Record<string, string>[]) => { added: number; errors: string[] } }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ added: number; errors: string[] } | null>(null);

  return (
    <>
      <Button variant="soft" onClick={() => { setText(""); setResult(null); setOpen(true); }}><Upload size={14} /> Import CSV</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} wide
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
          <Button variant="soft" onClick={() => setText(sample)}>Load sample</Button>
          <Button disabled={!text.trim()} onClick={() => setResult(onImport(parseCsvObjects(text)))}>Import</Button></>}>
        <div className="space-y-3">
          <p className="text-sm text-mist-500">Paste CSV with a header row. Columns are matched case-insensitively.</p>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[180px] font-mono text-xs" placeholder={sample} />
          {result && (
            <div className={`rounded-lg p-3 text-sm ${result.errors.length ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200" : "bg-brand-50 text-brand-700 ring-1 ring-brand-200"}`}>
              <p className="font-semibold">{result.added} row(s) imported.</p>
              {result.errors.slice(0, 8).map((e, i) => <p key={i} className="mt-0.5 text-xs">{e}</p>)}
              {result.errors.length > 8 && <p className="mt-0.5 text-xs">…and {result.errors.length - 8} more.</p>}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

import { useEffect, useState } from "react";
import { Eye, FileSearch } from "lucide-react";
import { DocViewer, type ViewableDoc } from "./DocViewer";

const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE = 10 * 1024 * 1024;

/** A temporary browser preview. It never uploads or persists the selected file. */
export function LocalFilePreview({ label }: { label: string }) {
  const [document, setDocument] = useState<ViewableDoc | null>(null);
  const [viewing, setViewing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => {
    if (document?.previewUrl) URL.revokeObjectURL(document.previewUrl);
  }, [document]);

  function select(file: File | undefined) {
    setViewing(false);
    if (!file) return;
    if (!ALLOWED_TYPES.has(file.type)) {
      setError("Choose a PDF, PNG, JPEG or WebP file.");
      setDocument(null);
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("Choose a file smaller than 10 MB for this local preview.");
      setDocument(null);
      return;
    }
    setError("");
    setDocument({ id: "local-preview", filename: file.name, mimeType: file.type, sizeKb: Math.ceil(file.size / 1024), previewUrl: URL.createObjectURL(file) });
  }

  return <div className="rounded-xl border border-dashed border-mist-300 bg-mist-50 p-4">
    <div className="flex items-start gap-3"><FileSearch size={18} className="mt-0.5 shrink-0 text-brand-600" /><div>
      <p className="text-sm font-semibold text-mist-800">{label}</p>
      <p className="mt-1 text-xs text-mist-500">Local preview only. The file is not uploaded, attached to a record or retained after this page closes. Use synthetic files in this demo.</p>
    </div></div>
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <input aria-label={`Select ${label.toLowerCase()}`} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(event) => select(event.target.files?.[0])} className="min-w-0 max-w-full text-xs text-mist-600 file:mr-2 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:font-semibold file:text-brand-700" />
      {document && <button type="button" className="btn-soft text-xs" onClick={() => setViewing(true)}><Eye size={14} /> Preview {document.filename}</button>}
    </div>
    {error && <p role="alert" className="mt-2 text-xs text-action-700">{error}</p>}
    {viewing && document && <DocViewer docs={[document]} onClose={() => setViewing(false)} />}
  </div>;
}

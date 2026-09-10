import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Download, FileText, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";

export type ViewableDoc = { id: string; type?: string; filename: string; sizeKb?: number; dataUrl?: string };

// A lightweight document viewer/lightbox. Renders image and PDF data URLs
// inline; for documents without a data URL (the common demo case) it shows a
// styled placeholder with the metadata. Supports zoom and prev/next when given
// a list.
export function DocViewer({ docs, startIndex = 0, onClose }: { docs: ViewableDoc[]; startIndex?: number; onClose: () => void }) {
  const [i, setI] = useState(startIndex);
  const [zoom, setZoom] = useState(1);
  const doc = docs[i];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopImmediatePropagation(); onClose(); }
      if (e.key === "ArrowRight") setI((x) => Math.min(docs.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    // capture phase so this runs before the parent Modal's Escape handler
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [docs.length, onClose]);

  if (!doc) return null;
  const isImg = doc.dataUrl?.startsWith("data:image");
  const isPdf = doc.dataUrl?.startsWith("data:application/pdf");

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[60] grid place-items-center bg-mist-900/70 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="absolute inset-0" onClick={onClose} />
        <motion.div initial={{ scale: 0.96 }} animate={{ scale: 1 }} className="relative z-10 flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-pop">
          <div className="flex items-center justify-between gap-3 border-b border-mist-100 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-mist-900">{doc.filename}</p>
              <p className="text-xs text-mist-400">{doc.type ?? "Document"}{doc.sizeKb ? ` · ${doc.sizeKb} KB` : ""}{docs.length > 1 ? ` · ${i + 1} of ${docs.length}` : ""}</p>
            </div>
            <div className="flex items-center gap-1">
              {(isImg || isPdf) && <>
                <button className="btn-ghost px-2 py-1" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}><ZoomOut size={15} /></button>
                <button className="btn-ghost px-2 py-1" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}><ZoomIn size={15} /></button>
              </>}
              {doc.dataUrl && <a href={doc.dataUrl} download={doc.filename} className="btn-ghost px-2 py-1"><Download size={15} /></a>}
              <button className="btn-ghost px-2 py-1" onClick={onClose}><X size={16} /></button>
            </div>
          </div>

          <div className="relative min-h-[320px] flex-1 overflow-auto bg-mist-50 p-4">
            {docs.length > 1 && (
              <>
                <button disabled={i === 0} onClick={() => setI(i - 1)} className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow disabled:opacity-30"><ChevronLeft size={18} /></button>
                <button disabled={i === docs.length - 1} onClick={() => setI(i + 1)} className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow disabled:opacity-30"><ChevronRight size={18} /></button>
              </>
            )}
            {isImg ? (
              <img src={doc.dataUrl} alt={doc.filename} style={{ transform: `scale(${zoom})` }} className="mx-auto origin-top rounded-lg shadow" />
            ) : isPdf ? (
              <iframe src={doc.dataUrl} title={doc.filename} className="h-[60vh] w-full rounded-lg border border-mist-200" />
            ) : (
              <div className="mx-auto flex h-full max-w-sm flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-mist-300 bg-white py-16 text-center">
                <FileText size={40} className="text-mist-300" />
                <p className="font-semibold text-mist-700">{doc.filename}</p>
                <p className="text-sm text-mist-400">No inline preview available for this file in the demo.<br />In a deployed build the document would render here.</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

import { useRef, useState } from "react";
import { Paperclip, Trash2, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { useDocuments, type AttachmentEntity } from "@/store/accounting/useDocuments";
import { shortDate } from "@/lib/format";
import { useHr } from "@/store/useHr";
import { useIsLiveEmr } from "@/emr-live/session";
import { openAttachment, uploadAttachment, useLiveAttachmentsMeta } from "@/accounting-live/attachments";

// A compact attachments block for any accounting record.
export function Attachments({ entityType, entityId, entityLabel }: { entityType: AttachmentEntity; entityId: string; entityLabel: string }) {
  const { attachmentsFor, addAttachment, removeAttachment } = useDocuments();
  const staff = useHr((s) => s.staff);
  const inputRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const list = attachmentsFor(entityType, entityId);
  // A live hospital's files go to the server and stay in quarantine until the virus scanner clears them.
  const live = useIsLiveEmr();
  const liveMeta = useLiveAttachmentsMeta();
  const canAttach = !live || liveMeta.enabled;

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (live) {
      void uploadAttachment(file, { entityType, entityId, entityLabel, note: note || undefined });
      setNote("");
      e.target.value = "";
      return;
    }
    const sizeKb = Math.max(1, Math.round(file.size / 1024));
    const finish = (dataUrl?: string) => { addAttachment({ entityType, entityId, entityLabel, filename: file.name, mimeType: file.type || "application/octet-stream", sizeKb, dataUrl, note: note || undefined }); setNote(""); };
    if (file.size <= 512 * 1024) {
      const reader = new FileReader();
      reader.onload = () => finish(typeof reader.result === "string" ? reader.result : undefined);
      reader.readAsDataURL(file);
    } else finish();
    e.target.value = "";
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-mist-400">Attachments ({list.length})</span>
        <div className="flex items-center gap-1.5">
          <input className="input h-7 w-32 text-xs" placeholder="note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <input ref={inputRef} type="file" hidden onChange={onFile} />
          <Button variant="soft" disabled={!canAttach || liveMeta.uploading.length > 0} title={canAttach ? undefined : "Attaching files isn't set up for this deployment"} onClick={() => inputRef.current?.click()}><Paperclip size={12} /> {liveMeta.uploading.length ? "Sending…" : "Attach"}</Button>
        </div>
      </div>
      {live && liveMeta.loaded && !liveMeta.enabled && <p className="mb-1.5 text-xs text-amber-700">Attaching files isn't set up for this deployment yet — it needs the private document storage and the virus scanner. Keep the document in your filing for now.</p>}
      {live && liveMeta.error && <p role="alert" className="mb-1.5 text-xs text-action-700">{liveMeta.error}</p>}
      {list.length === 0 ? <p className="text-sm text-mist-400">No files attached.</p> : (
        <div className="space-y-1.5">
          {list.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-mist-50 px-3 py-1.5 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <FileText size={14} className="shrink-0 text-mist-400" />
                <span className="truncate font-medium">{a.filename}</span>
                {a.version > 1 && <span className="shrink-0 rounded bg-mist-200 px-1 text-[10px]">v{a.version}</span>}
                <span className="shrink-0 text-xs text-mist-400">{a.sizeKb} KB · {staff.find((s) => s.id === a.uploadedBy)?.name?.split(" ").slice(-1)[0] ?? a.uploadedBy} · {shortDate(a.uploadedAt)}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {a.status === "PENDING_SCAN" && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">{a.scanError ? "Check delayed" : "Checking for viruses…"}</span>}
                {(a.status === "INFECTED" || a.status === "REJECTED") && <span className="rounded bg-action-50 px-1.5 py-0.5 text-[10px] font-semibold text-action-700 ring-1 ring-action-200">Failed the security check</span>}
                {live && a.status === "CLEAN" && <button className="btn-ghost px-1.5 py-1" aria-label={`Open ${a.filename}`} onClick={() => void openAttachment(a.id)}><Download size={12} /></button>}
                {a.dataUrl && <a href={a.dataUrl} download={a.filename} className="btn-ghost px-1.5 py-1"><Download size={12} /></a>}
                <button className="text-action-500 hover:text-action-700" onClick={() => removeAttachment(a.id)}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

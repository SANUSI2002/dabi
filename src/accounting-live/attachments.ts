import { create } from "zustand";
import { useDocuments, type Attachment, type AttachmentEntity } from "@/store/accounting/useDocuments";
import { accountingRequest, accountingUpload, describeEmrError, newIdempotencyKey } from "@/emr-live/client";
import { liveChange } from "@/workforce-live/sync";

// Attachments on bills and invoices for a live hospital (GET /attachments): the file goes to the server,
// which keeps it in quarantine until the virus scanner clears it; only a clean file opens, through a link
// that lasts a minute. While a file is being checked the list refreshes on its own. A deployment without
// the private storage or the scanner says attaching is not set up.

type ApiList = { enabled: boolean; maxBytes: number; contentTypes: string[]; items: Attachment[] };
export const useLiveAttachmentsMeta = create<{ loaded: boolean; enabled: boolean; maxBytes: number; contentTypes: string[]; uploading: string[]; error: string }>(
  () => ({ loaded: false, enabled: false, maxBytes: 0, contentTypes: [], uploading: [], error: "" }),
);

let poll: ReturnType<typeof setTimeout> | undefined;
export async function loadAttachments() {
  const { data } = await accountingRequest<{ data: ApiList }>("/attachments");
  useLiveAttachmentsMeta.setState({ loaded: true, enabled: data.enabled, maxBytes: data.maxBytes, contentTypes: data.contentTypes });
  useDocuments.setState({ attachments: data.items });
  clearTimeout(poll);
  // a file waiting for its scan shows its verdict without a manual refresh
  if (data.items.some((a) => a.status === "PENDING_SCAN" && !a.scanError)) poll = setTimeout(() => { void loadAttachments().catch(() => undefined); }, 15000);
}
const reload = () => loadAttachments();

/** Sends one file for a bill or invoice; the list shows it as being checked until the scan is done. */
export async function uploadAttachment(file: File, target: { entityType: AttachmentEntity; entityId: string; entityLabel: string; note?: string }) {
  const meta = useLiveAttachmentsMeta.getState();
  if (!meta.contentTypes.includes(file.type)) return useLiveAttachmentsMeta.setState({ error: "Attach a PDF, JPEG or PNG file." });
  if (file.size > meta.maxBytes) return useLiveAttachmentsMeta.setState({ error: `That file is larger than ${(meta.maxBytes / 1024 / 1024).toFixed(1)} MB.` });
  const query = new URLSearchParams({ entityType: target.entityType, entityId: target.entityId, entityLabel: target.entityLabel, ...(target.note ? { note: target.note } : {}) });
  const key = newIdempotencyKey();
  useLiveAttachmentsMeta.setState((s) => ({ error: "", uploading: [...s.uploading, key] }));
  try {
    await accountingUpload(`/attachments/receive?${query}`, file, { "X-Document-Filename": encodeURIComponent(file.name), "Idempotency-Key": key });
    await reload();
  } catch (cause) {
    useLiveAttachmentsMeta.setState({ error: describeEmrError(cause) });
  } finally {
    useLiveAttachmentsMeta.setState((s) => ({ uploading: s.uploading.filter((k) => k !== key) }));
  }
}

/** Opens a clean file through its one-minute link. */
export async function openAttachment(id: string) {
  try {
    const { data } = await accountingRequest<{ data: { url: string } }>(`/attachments/${id}/download`, { method: "POST", body: {} });
    window.open(data.url, "_blank", "noopener");
  } catch (cause) {
    useLiveAttachmentsMeta.setState({ error: describeEmrError(cause) });
  }
}

export function goLiveAttachments() {
  useDocuments.setState({
    // files are sent with uploadAttachment (they need the bytes, not a preview)
    addAttachment: () => useLiveAttachmentsMeta.setState({ error: "Choose the file again to send it." }),
    removeAttachment: (id) => {
      void liveChange(() => accountingRequest(`/attachments/${id}/remove`, { method: "POST", body: {} }), reload,
        () => useDocuments.setState((s) => ({ attachments: s.attachments.filter((a) => a.id !== id) })));
    },
  });
}

export function clearAttachments() {
  clearTimeout(poll);
  useLiveAttachmentsMeta.setState({ loaded: false, enabled: false, uploading: [], error: "" });
  useDocuments.setState({ attachments: [] });
}

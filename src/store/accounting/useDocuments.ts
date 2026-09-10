import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";

// B19 — document attachments. Any accounting record can carry files; re-uploading
// the same filename creates a new version rather than overwriting.

export type AttachmentEntity = "invoice" | "bill" | "expense" | "journal" | "customer" | "vendor" | "payment" | "asset";

export type Attachment = {
  id: string;
  entityType: AttachmentEntity;
  entityId: string;
  entityLabel: string; // human ref e.g. "INV-2026-001001"
  filename: string;
  mimeType: string;
  sizeKb: number;
  dataUrl?: string; // small files only
  version: number;
  uploadedBy: string;
  uploadedAt: string;
  note?: string;
};

const rid = () => Math.random().toString(36).slice(2, 9);

const seed: Attachment[] = [
  { id: "att-1", entityType: "bill", entityId: "bill-7001", entityLabel: "BILL-2026-007001", filename: "emzor-invoice-88231.pdf", mimeType: "application/pdf", sizeKb: 214, version: 1, uploadedBy: "s6", uploadedAt: new Date(Date.now() - 12 * 864e5).toISOString(), note: "Supplier invoice" },
];

type DocumentsState = {
  attachments: Attachment[];
  attachmentsFor: (entityType: AttachmentEntity, entityId: string) => Attachment[];
  addAttachment: (input: { entityType: AttachmentEntity; entityId: string; entityLabel: string; filename: string; mimeType: string; sizeKb: number; dataUrl?: string; note?: string }) => void;
  removeAttachment: (id: string) => void;
};

export const useDocuments = create<DocumentsState>((set, get) => ({
  attachments: seed,
  attachmentsFor: (entityType, entityId) => get().attachments.filter((a) => a.entityType === entityType && a.entityId === entityId).sort((a, b) => b.version - a.version || b.uploadedAt.localeCompare(a.uploadedAt)),
  addAttachment: (input) => {
    const prior = get().attachments.filter((a) => a.entityType === input.entityType && a.entityId === input.entityId && a.filename === input.filename);
    const version = prior.length ? Math.max(...prior.map((p) => p.version)) + 1 : 1;
    set((s) => ({ attachments: [{ ...input, id: `att-${rid()}`, version, uploadedBy: useIdentity.getState().user.id, uploadedAt: new Date().toISOString() }, ...s.attachments] }));
    audit(`attached ${input.filename}${version > 1 ? ` (v${version})` : ""} to ${input.entityLabel}`, `accounting/${input.entityType}s/${input.entityLabel}`);
  },
  removeAttachment: (id) => {
    const a = get().attachments.find((x) => x.id === id);
    set((s) => ({ attachments: s.attachments.filter((x) => x.id !== id) }));
    if (a) audit(`removed attachment ${a.filename} from ${a.entityLabel}`, `accounting/${a.entityType}s/${a.entityLabel}`);
  },
}));

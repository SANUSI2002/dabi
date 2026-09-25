import React, { useRef, useState } from "react";
import { Card, Button } from "design-system";
import { Download, FileText, Loader2, RefreshCw, Trash2, Upload } from "lucide-react";
import { SectionTitle } from "../../dashboard/share";
import { ConfirmModal } from "./ConfirmModal";
import {
  DOCUMENT_KINDS,
  DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
  deleteDocument,
  documentDownloadUrl,
  uploadDocument,
} from "../../../api/recordsApi";

const formatSize = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const formatDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });

/**
 * Opens a signed download link. The tab is opened synchronously inside the click so popup
 * blockers allow it, then pointed at the short-lived URL once the API issues it.
 */
async function openDocument(id) {
  const tab = window.open("", "_blank");
  try {
    const url = await documentDownloadUrl(id);
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else {
      window.location.assign(url);
    }
  } catch (error) {
    tab?.close();
    throw error;
  }
}

/** The patient's documents, optionally limited to those attached to one record. */
export function DocumentList({ documents, onChanged, emptyText = "No documents uploaded yet." }) {
  const [busyId, setBusyId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [error, setError] = useState(null);

  const run = async (id, work) => {
    setBusyId(id);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  if (!documents.length) return <p className="sabi-modal-empty">{emptyText}</p>;

  return (
    <>
      <ul className="sabi-docs-list">
        {documents.map((doc) => (
          <li key={doc.id} className="sabi-docs-row">
            <span className="sabi-docs-icon"><FileText size={17} /></span>
            <div className="sabi-docs-body">
              <div className="sabi-docs-name" title={doc.filename}>{doc.filename}</div>
              <div className="sabi-docs-meta">
                {doc.kindLabel} · {formatSize(doc.byteSize)} · {formatDate(doc.createdAt)}
              </div>
            </div>
            <span className={`sabi-status-pill ${doc.tone}`}>{doc.statusLabel}</span>
            <div className="sabi-docs-actions">
              {doc.downloadable && (
                <button type="button" aria-label={`Open ${doc.filename}`} title="Open" disabled={busyId === doc.id} onClick={() => run(doc.id, () => openDocument(doc.id))}>
                  {busyId === doc.id ? <Loader2 size={14} className="sabi-spin" /> : <Download size={14} />}
                </button>
              )}
              <button type="button" aria-label={`Delete ${doc.filename}`} title="Delete" disabled={busyId === doc.id} onClick={() => setConfirmDelete(doc)}>
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="sabi-form-error" role="alert">{error}</p>}
      {confirmDelete && (
        <ConfirmModal
          title="Delete this document?"
          message={`"${confirmDelete.filename}" will be permanently removed from secure storage, and anyone you shared it with loses access.`}
          confirmLabel="Delete"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            const doc = confirmDelete;
            setConfirmDelete(null);
            run(doc.id, async () => {
              await deleteDocument(doc.id);
              await onChanged();
            });
          }}
        />
      )}
    </>
  );
}

/** Upload control. `medicalRecordId` attaches the file to that record. */
export function DocumentUpload({ records = [], medicalRecordId, onUploaded }) {
  const fileInput = useRef(null);
  const [file, setFile] = useState(null);
  const [kind, setKind] = useState("MEDICAL_RECORD");
  const [recordId, setRecordId] = useState(medicalRecordId || "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const pick = (e) => {
    const chosen = e.target.files?.[0] || null;
    setError(null);
    setNotice(null);
    if (chosen && !DOCUMENT_TYPES.includes(chosen.type)) {
      setError("Only PDF, JPEG or PNG files can be uploaded.");
      setFile(null);
    } else if (chosen && chosen.size > MAX_DOCUMENT_BYTES) {
      setError("Files must be 10 MB or smaller.");
      setFile(null);
    } else {
      setFile(chosen);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadDocument(file, { kind, medicalRecordId: recordId || undefined });
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setNotice("Uploaded. It will be available once the security scan finishes.");
      await onUploaded();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <form className="sabi-docs-upload" onSubmit={submit}>
      <div className="sabi-record-form-row">
        <label>
          File (PDF, JPEG or PNG, up to 10 MB)
          <input ref={fileInput} type="file" accept={DOCUMENT_TYPES.join(",")} onChange={pick} />
        </label>
        <label>
          Document type
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {DOCUMENT_KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </label>
      </div>
      {!medicalRecordId && records.length > 0 && (
        <label>
          Attach to a record (optional)
          <select value={recordId} onChange={(e) => setRecordId(e.target.value)}>
            <option value="">Not attached</option>
            {records.map((r) => (
              <option key={r.id} value={r.id}>{r.title} — {r.date}</option>
            ))}
          </select>
        </label>
      )}
      {error && <p className="sabi-form-error" role="alert">{error}</p>}
      {notice && <p className="sabi-docs-notice" role="status">{notice}</p>}
      <div className="sabi-modal-actions">
        <Button type="submit" variant="primary" disabled={!file || uploading}>
          {uploading ? <Loader2 size={15} className="sabi-spin" style={{ verticalAlign: "-3px", marginRight: 6 }} /> : <Upload size={15} style={{ verticalAlign: "-3px", marginRight: 6 }} />}
          {uploading ? "Uploading…" : "Upload"}
        </Button>
      </div>
    </form>
  );
}

export function DocumentsCard({ documents, records }) {
  const [showUpload, setShowUpload] = useState(false);
  const items = documents.data || [];

  return (
    <section id="records-documents">
      <SectionTitle
        action={
          <>
            <RefreshCw size={13} className={documents.loading ? "sabi-spin" : undefined} style={{ verticalAlign: "-2px" }} /> Refresh
          </>
        }
        onAction={documents.reload}
      >
        Documents
      </SectionTitle>
      <Card className="sabi-docs-card">
        <p className="sabi-organized-sub">
          Lab reports, scans and letters are stored privately and checked for malware before anyone can open them.
        </p>
        {documents.error ? (
          <p className="sabi-form-error" role="alert">{documents.error.message}</p>
        ) : documents.loading && !documents.data ? (
          <p className="sabi-modal-empty">Loading documents…</p>
        ) : (
          <DocumentList documents={items} onChanged={documents.reload} />
        )}
        {showUpload ? (
          <DocumentUpload records={records} onUploaded={documents.reload} />
        ) : (
          <div className="sabi-modal-actions">
            <Button type="button" variant="secondary" onClick={() => setShowUpload(true)}>
              <Upload size={15} style={{ verticalAlign: "-3px", marginRight: 6 }} />
              Upload a document
            </Button>
          </div>
        )}
      </Card>
    </section>
  );
}

export default DocumentsCard;

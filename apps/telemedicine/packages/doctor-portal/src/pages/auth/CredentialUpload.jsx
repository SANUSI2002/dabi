import React from "react";
import { documentError } from "./registrationModel";

export default function CredentialUpload({ kind, label, document, file, maxBytes, busy, onSelect, onUpload }) {
  const error = file ? documentError(file, maxBytes) : "";
  return <section className="sh-review-section sh-credential-upload" aria-label={label} aria-busy={busy === kind}>
    <h3>{label}</h3>
    <p>{document ? `Screening: ${document.scanStatus} · Authenticity: ${document.reviewStatus}` : "Not uploaded"}</p>
    {document?.scanErrorCode && <p className="sh-form-notice">Screening needs attention ({document.scanErrorCode}). Contact operations for a retry, or replace an unsafe file.</p>}
    {document?.reviewStatus === "REJECTED" && <p className="sh-form-notice">{document.note || "Replace this document with corrected evidence."}</p>}
    <div className="sh-auth-field">
      <label htmlFor={kind}>{document ? "Replace document" : "Choose document"}</label>
      <input id={kind} type="file" accept="application/pdf,image/png,image/jpeg" disabled={!!busy} aria-describedby={`${kind}-selection`} onChange={(event) => {
        // Capture the File before clearing the native picker. React may defer the
        // parent's state updater until after this event handler returns.
        const selected = event.currentTarget.files?.[0];
        if (selected) onSelect(kind, selected);
        event.currentTarget.value = "";
      }} />
    </div>
    <p id={`${kind}-selection`} role="status">{file ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB${error ? "" : " · Ready to upload"}` : "Choose a file, then click Upload privately."}</p>
    {error && <p className="sh-field-error" role="alert">{error}</p>}
    <button type="button" className="sh-secondary-button" disabled={!!busy || !file || !!error} onClick={() => onUpload(kind)}>{busy === kind ? "Uploading…" : document ? "Upload replacement" : "Upload privately"}</button>
    {busy === kind && <p role="status">Sending your document to private storage. Please keep this page open; screening happens after upload.</p>}
  </section>;
}

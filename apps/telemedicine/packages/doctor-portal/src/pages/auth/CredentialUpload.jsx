import React from "react";
import { documentError } from "./registrationModel";

export default function CredentialUpload({ kind, label, document, file, maxBytes, busy, uploadError, onSelect, onRetry }) {
  const error = (file ? documentError(file, maxBytes) : "") || uploadError;
  return <section className="sh-review-section sh-credential-upload" aria-label={label} aria-busy={busy === kind}>
    <h3>{label}</h3>
    <p>{document ? "Document uploaded" : "No document uploaded yet"}</p>
    {document && <p>{document.scanStatus === "CLEAN" ? document.reviewStatus === "VERIFIED" ? "Reviewed and accepted by Sabi operations." : "Security check complete. Awaiting Sabi operations review." : ["INFECTED", "REJECTED"].includes(document.scanStatus) ? "This document did not pass the security check. Choose a different file." : document.scanStatus === "FAILED" ? "The security check needs attention. Sabi operations can retry it." : "Security check in progress automatically. You do not need to do anything."}</p>}
    {document?.reviewStatus === "REJECTED" && <p className="sh-form-notice">{document.note || "Replace this document with corrected evidence."}</p>}
    <div className="sh-auth-field">
      <label htmlFor={kind}>{document ? "Replace document" : "Upload document"}</label>
      <input id={kind} type="file" accept="application/pdf,image/png,image/jpeg" disabled={!!busy} aria-describedby={`${kind}-selection`} onChange={(event) => {
        // Capture the File before clearing the native picker. React may defer the
        // parent's state updater until after this event handler returns.
        const selected = event.currentTarget.files?.[0];
        if (selected) onSelect(kind, selected);
        event.currentTarget.value = "";
      }} />
    </div>
    <p id={`${kind}-selection`} role="status">{file ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB` : "Select a file. Upload and security checks run automatically."}</p>
    {error && <p className="sh-field-error" role="alert">{error}</p>}
    {uploadError && file && !documentError(file, maxBytes) && <button type="button" className="sh-secondary-button" disabled={!!busy} onClick={() => onRetry(kind, file)}>Retry upload</button>}
    {busy === kind && <p role="status">Uploading your document… Please keep this page open.</p>}
  </section>;
}

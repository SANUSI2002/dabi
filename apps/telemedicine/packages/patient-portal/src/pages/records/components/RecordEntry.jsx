import React from "react";
import { Download, Share2, ArrowRight, Paperclip } from "lucide-react";

export const recordSummary = (record) =>
  [
    record.title,
    `${record.date} · ${record.meta}`,
    record.diagnosis && `Diagnosis: ${record.diagnosis}`,
    record.treatment && `Treatment: ${record.treatment}`,
    record.notes && `Notes: ${record.notes}`,
  ]
    .filter(Boolean)
    .join("\n");

export function RecordEntry({ record, attachments = 0, onView }) {
  const summary = recordSummary(record);

  const handleDownload = () => {
    const blob = new Blob([summary], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${record.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: record.title, text: summary });
      } catch {
        /* user cancelled — ignore */
      }
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(summary).catch(() => {});
    }
  };

  const hasClinical = record.diagnosis || record.treatment;

  return (
    <div className="sabi-record-item">
      <div className="sabi-record-marker" aria-hidden="true">
        <span className="sabi-record-dot" />
        <span className="sabi-record-line" />
      </div>

      <div className="sabi-record-card">
        <div className="sabi-record-top">
          <span className="sabi-record-date">{record.date}</span>
          <div className="sabi-record-actions">
            <button type="button" aria-label="Download record summary" onClick={handleDownload}>
              <Download size={14} />
            </button>
            <button type="button" aria-label="Share record summary" onClick={handleShare}>
              <Share2 size={14} />
            </button>
          </div>
        </div>

        <h3 className="sabi-record-title">{record.title}</h3>
        <div className="sabi-record-meta">{record.meta}</div>

        {hasClinical ? (
          <div className="sabi-record-details">
            {record.diagnosis && (
              <div>
                <div className="sabi-record-detail-label">Diagnosis</div>
                <div className="sabi-record-detail-value">{record.diagnosis}</div>
              </div>
            )}
            {record.treatment && (
              <div>
                <div className="sabi-record-detail-label">Treatment</div>
                <div className="sabi-record-detail-value">{record.treatment}</div>
              </div>
            )}
          </div>
        ) : (
          record.notes && <p className="sabi-record-notes">{record.notes}</p>
        )}

        <div className="sabi-record-footer">
          <span className="sabi-record-tag">
            {attachments > 0 ? (
              <>
                <Paperclip size={13} /> {attachments} {attachments === 1 ? "document" : "documents"}
              </>
            ) : (
              record.typeLabel
            )}
          </span>
          <button type="button" className="sabi-record-link" onClick={onView}>
            View Full Record <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default RecordEntry;

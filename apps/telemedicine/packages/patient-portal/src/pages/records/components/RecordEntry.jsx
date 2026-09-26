import React from "react";
import { Link } from "react-router-dom";
import { Download, Share2, ArrowRight } from "lucide-react";

export function RecordEntry({ record }) {
  const TagIcon = record.tagIcon;

  const summary = `${record.title}\n${record.date} · ${record.meta}\n\nDiagnosis: ${record.diagnosis || "—"}\nTreatment: ${record.treatment || "—"}`;

  const handleDownload = () => {
    const blob = new Blob([summary], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${record.title.replace(/\s+/g, "-").toLowerCase()}.txt`;
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
            <button type="button" aria-label="Download record" onClick={handleDownload}>
              <Download size={14} />
            </button>
            <button type="button" aria-label="Share record" onClick={handleShare}>
              <Share2 size={14} />
            </button>
          </div>
        </div>

        <h3 className="sabi-record-title">{record.title}</h3>
        <div className="sabi-record-meta">{record.meta}</div>

        <div className="sabi-record-details">
          <div>
            <div className="sabi-record-detail-label">Diagnosis</div>
            <div className="sabi-record-detail-value">{record.diagnosis || "—"}</div>
          </div>
          <div>
            <div className="sabi-record-detail-label">Treatment</div>
            <div className="sabi-record-detail-value">{record.treatment || "—"}</div>
          </div>
        </div>

        <div className="sabi-record-footer">
          <span className="sabi-record-tag">
            {TagIcon && <TagIcon size={13} />} {record.tag}
          </span>
          <Link to={`/reports/${record.id}`} className="sabi-record-link">
            View Full Report <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default RecordEntry;

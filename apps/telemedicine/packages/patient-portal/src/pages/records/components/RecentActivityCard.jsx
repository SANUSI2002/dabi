import React from "react";
import { Card } from "design-system";
import { CloudUpload, FilePlus2 } from "lucide-react";

const when = (iso) => new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });

/** The latest few things in the patient's history: uploaded documents and dated records. */
export function RecentActivityCard({ records, documents }) {
  const items = [
    ...documents.map((d) => ({ key: `d-${d.id}`, icon: CloudUpload, title: "Document uploaded", sub: `${d.filename} · ${d.statusLabel}`, at: d.createdAt })),
    ...records.map((r) => ({ key: `r-${r.id}`, icon: FilePlus2, title: r.title, sub: r.meta, at: r.dateIso })),
  ]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 4);

  return (
    <Card>
      <div className="sabi-section-title">Recent Activity</div>

      {items.length === 0 ? (
        <p className="sabi-modal-empty">Nothing here yet — your newest records and uploads will show up here.</p>
      ) : (
        <div className="sabi-activity-list">
          {items.map((item) => (
            <div className="sabi-activity-item" key={item.key}>
              <div className="sabi-activity-icon">
                <item.icon size={16} />
              </div>
              <div className="sabi-activity-body">
                <div className="sabi-activity-title">{item.title}</div>
                <div className="sabi-activity-sub">{item.sub}</div>
                <div className="sabi-activity-time">{when(item.at).toUpperCase()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default RecentActivityCard;

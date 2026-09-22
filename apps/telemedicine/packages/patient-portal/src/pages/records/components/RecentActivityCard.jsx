import React from "react";
import { Card } from "design-system";
import { MoreVertical } from "lucide-react";
import { RECENT_ACTIVITY } from "../data";

export function RecentActivityCard() {
  return (
    <Card>
      <div className="sabi-section-title">
        Recent Activity
        <button type="button" className="sabi-activity-more" aria-label="More options">
          <MoreVertical size={16} />
        </button>
      </div>

      <div className="sabi-activity-list">
        {RECENT_ACTIVITY.map((item, i) => (
          <div className="sabi-activity-item" key={i}>
            <div className="sabi-activity-icon">
              <item.icon size={16} />
            </div>
            <div className="sabi-activity-body">
              <div className="sabi-activity-title">{item.title}</div>
              <div className="sabi-activity-sub">{item.sub}</div>
              <div className="sabi-activity-time">{item.time.toUpperCase()}</div>
            </div>
          </div>
        ))}
      </div>

      <button type="button" className="sabi-activity-viewall">
        View All Activity
      </button>
    </Card>
  );
}

export default RecentActivityCard;

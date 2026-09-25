import React from "react";
import { Card } from "design-system";
import { Lightbulb } from "lucide-react";

export function HealthInsightCard() {
  return (
    <Card className="sabi-healthinsight">
      <div className="sabi-healthinsight-icon">
        <Lightbulb size={22} />
      </div>
      <div className="sabi-healthinsight-title">Keep Your History Complete</div>
      <p className="sabi-healthinsight-text">
        Uploading your previous medical history helps your care team see the full picture. Add past lab reports, scans
        and letters to your secure documents.
      </p>
      <button
        type="button"
        className="sabi-healthinsight-cta"
        onClick={() => document.getElementById("records-documents")?.scrollIntoView({ behavior: "smooth", block: "start" })}
      >
        Upload a Document
      </button>
    </Card>
  );
}

export default HealthInsightCard;

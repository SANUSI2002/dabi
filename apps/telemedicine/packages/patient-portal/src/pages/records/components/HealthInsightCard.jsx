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
        Uploading your previous medical history helps your care team see the full picture. Securely import your
        external records today.
      </p>
      <button type="button" className="sabi-healthinsight-cta">
        Connect External Health App
      </button>
    </Card>
  );
}

export default HealthInsightCard;

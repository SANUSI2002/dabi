import React from "react";
import { Card } from "design-system";
import { Siren, ArrowUpRight } from "lucide-react";
import { jsPDF } from "jspdf";
import { useApiData } from "../../../api/useApiData";
import { getEmergencySummary } from "../../../api/recordsApi";

export function VitalInfoCard() {
  // The patient's own medical profile, as shown on their emergency summary.
  const { data: summary } = useApiData(getEmergencySummary, []);
  const VITAL_INFO = {
    bloodGroup: summary?.bloodGroup || "Not recorded",
    genotype: summary?.genotype || "Not recorded",
    allergies: summary?.allergies?.length ? summary.allergies : ["None recorded"],
    chronicCondition: summary?.chronicConditions || "None recorded",
  };

  const generateEmergencyPDF = () => {
    const doc = new jsPDF();

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("Emergency Medical Information", 20, 20);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("This document contains important emergency medical information.", 20, 30);

    // Divider
    doc.line(20, 35, 190, 35);

    // Blood Group
    doc.setFont("helvetica", "bold");
    doc.text("Blood Group:", 20, 50);
    doc.setFont("helvetica", "normal");
    doc.text(VITAL_INFO.bloodGroup, 70, 50);

    // Genotype
    doc.setFont("helvetica", "bold");
    doc.text("Genotype:", 20, 60);
    doc.setFont("helvetica", "normal");
    doc.text(VITAL_INFO.genotype, 70, 60);

    // Allergies
    doc.setFont("helvetica", "bold");
    doc.text("Allergies:", 20, 75);
    doc.setFont("helvetica", "normal");
    doc.text(VITAL_INFO.allergies.join(", "), 20, 85);

    // Chronic Condition
    doc.setFont("helvetica", "bold");
    doc.text("Chronic Condition:", 20, 105);
    doc.setFont("helvetica", "normal");
    doc.text(VITAL_INFO.chronicCondition || "None", 20, 115);

    // Footer
    doc.setDrawColor(200);
    doc.line(20, 270, 190, 270);

    doc.setFontSize(10);
    doc.text(
      `Generated on ${new Date().toLocaleString()}`,
      20,
      280
    );

    doc.save("Emergency-Medical-Info.pdf");
  };

  return (
    <Card className="sabi-vitalinfo">
      <span className="sabi-vitalinfo-badge">Emergency ID</span>

      <div className="sabi-vitalinfo-head">
        <span className="sabi-vitalinfo-icon">
          <Siren size={19} />
        </span>

        <div>
          <div className="sabi-vitalinfo-title">Vital Info</div>
          <div className="sabi-vitalinfo-sub">Priority Access Data</div>
        </div>
      </div>

      <div className="sabi-vitalinfo-grid">
        <div className="sabi-vitalinfo-box">
          <div className="sabi-vitalinfo-label">Blood Group</div>
          <div className="sabi-vitalinfo-value">
            {VITAL_INFO.bloodGroup}
          </div>
        </div>

        <div className="sabi-vitalinfo-box">
          <div className="sabi-vitalinfo-label">Genotype</div>
          <div className="sabi-vitalinfo-value">
            {VITAL_INFO.genotype}
          </div>
        </div>
      </div>

      <div className="sabi-vitalinfo-box sabi-vitalinfo-box-wide">
        <div className="sabi-vitalinfo-label">Allergies</div>

        <div className="sabi-vitalinfo-pills">
          {VITAL_INFO.allergies.map((a) => (
            <span key={a} className="sabi-vitalinfo-pill">
              {a}
            </span>
          ))}
        </div>
      </div>

      <div className="sabi-vitalinfo-box sabi-vitalinfo-box-wide">
        <div className="sabi-vitalinfo-label">Chronic Conditions</div>

        <div className="sabi-vitalinfo-condition">
          {VITAL_INFO.chronicCondition}
        </div>
      </div>

      <button
        type="button"
        className="sabi-vitalinfo-cta"
        onClick={generateEmergencyPDF}
      >
        <ArrowUpRight size={16} />
        Generate Emergency PDF
      </button>
    </Card>
  );
}

export default VitalInfoCard;
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../../styles/share.css";
import "./PrescriptionDetail.css";
import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";

import { Sidebar, Topbar } from "../dashboard/components";
import {
  DetailHeader,
  MedicationsInPrescriptionCard,
  DiagnosisOverviewCard,
  WhyThisMedicationCard,
  UsageSafetyCard,
  RecoveryForecastCard,
  DetailActionBar,
} from "./components/detail";
import { getPrescriptionDetail } from "./prescriptionStore";

export function PrescriptionDetailPage() {
  const [zoom] = useZoom();
  const { id } = useParams();
  const navigate = useNavigate();

  const detail = getPrescriptionDetail(id);

  /* DEBUG NOTE: Prescriptions refactor - Build one clean summary for download and native/clipboard sharing. */
  const prescriptionSummary = [
    `Prescription: ${detail?.name || ""}`,
    `Patient: SabiHealth Patient`,
    `Prescribing doctor: ${detail?.physician || ""}`,
    `Date issued: ${detail?.issueDate || "Not recorded"}`,
    "Medications:",
    ...(detail?.items || []).map((item) => `- ${item.name}: ${item.dosage} (${item.qty})`),
  ].join("\n");

  const handleDownload = () => {
    const blob = new Blob([prescriptionSummary], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${detail.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-prescription.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `Prescription: ${detail.name}`, text: prescriptionSummary });
        return;
      }
      await navigator.clipboard.writeText(prescriptionSummary);
      window.alert("Prescription copied to clipboard!");
    } catch (error) {
      if (error.name !== "AbortError") window.alert("Unable to share this prescription. Please try again.");
    }
  };

  if (!detail) {
    return (
      <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
        <Sidebar />
        <div className="sabi-main">
          <Topbar />
          <div className="sabi-card">
            <p>We couldn&apos;t find details for this prescription.</p>
            <button
              className="sabi-btn-primary"
              onClick={() => navigate("/prescriptions")}
            >
              Back to Prescriptions
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar />

        <DetailHeader
          detail={detail}
          onBack={() => navigate("/prescriptions")}
          onShare={handleShare}
          onPrint={() => window.print()}
        />

        <MedicationsInPrescriptionCard items={detail.items} />

        <div className="sabi-rxd-top-grid">
          <DiagnosisOverviewCard diagnosis={detail.diagnosis} />
          <WhyThisMedicationCard items={detail.whyThisMedication} />
        </div>

        <UsageSafetyCard
          dosageInstructions={detail.dosageInstructions}
          sideEffects={detail.sideEffects}
          sideEffectsNote={detail.sideEffectsNote}
          criticalInteraction={detail.criticalInteraction}
        />

        <RecoveryForecastCard forecast={detail.recoveryForecast} />

        <DetailActionBar
          nextDose={detail.nextDose}
          onDownloadPdf={handleDownload}
          onBuyNow={() => navigate(`/prescriptions/${detail.id}/select-pharmacy`)}
        />
      </div>
    </div>
  );
}

export default PrescriptionDetailPage;

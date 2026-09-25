import React, { useState } from "react";
import { Card } from "design-system";
import { Siren, ArrowUpRight, Loader2 } from "lucide-react";
import { useApiData } from "../../../api/useApiData";
import { downloadEmergencyPdf, getEmergencySummary } from "../../../api/recordsApi";

const NOT_RECORDED = "Not recorded";

export function VitalInfoCard() {
  const { data: info, loading, error } = useApiData(getEmergencySummary, []);
  const [generating, setGenerating] = useState(false);
  const [pdfError, setPdfError] = useState(null);

  // The PDF is built by the API from the same profile data, so it can never disagree with this card.
  const generateEmergencyPDF = async () => {
    setGenerating(true);
    setPdfError(null);
    try {
      const blob = await downloadEmergencyPdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Emergency-Medical-Info.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setPdfError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const value = (v) => (loading ? "…" : v || NOT_RECORDED);

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

      {error ? (
        <p className="sabi-form-error" role="alert">{error.message}</p>
      ) : (
        <>
          <div className="sabi-vitalinfo-grid">
            <div className="sabi-vitalinfo-box">
              <div className="sabi-vitalinfo-label">Blood Group</div>
              <div className="sabi-vitalinfo-value">{value(info?.bloodGroup)}</div>
            </div>

            <div className="sabi-vitalinfo-box">
              <div className="sabi-vitalinfo-label">Genotype</div>
              <div className="sabi-vitalinfo-value">{value(info?.genotype)}</div>
            </div>
          </div>

          <div className="sabi-vitalinfo-box sabi-vitalinfo-box-wide">
            <div className="sabi-vitalinfo-label">Allergies</div>
            {info?.allergies?.length ? (
              <div className="sabi-vitalinfo-pills">
                {info.allergies.map((a) => (
                  <span key={a} className="sabi-vitalinfo-pill">{a}</span>
                ))}
              </div>
            ) : (
              <div className="sabi-vitalinfo-condition">{loading ? "…" : "None recorded"}</div>
            )}
          </div>

          <div className="sabi-vitalinfo-box sabi-vitalinfo-box-wide">
            <div className="sabi-vitalinfo-label">Chronic Conditions</div>
            <div className="sabi-vitalinfo-condition">{loading ? "…" : info?.chronicConditions || "None recorded"}</div>
          </div>

          {info?.emergencyContact && (
            <div className="sabi-vitalinfo-box sabi-vitalinfo-box-wide">
              <div className="sabi-vitalinfo-label">Emergency Contact</div>
              <div className="sabi-vitalinfo-condition">{info.emergencyContact}</div>
            </div>
          )}
        </>
      )}

      {pdfError && <p className="sabi-form-error" role="alert">{pdfError}</p>}
      <button type="button" className="sabi-vitalinfo-cta" onClick={generateEmergencyPDF} disabled={generating}>
        {generating ? <Loader2 size={16} className="sabi-spin" /> : <ArrowUpRight size={16} />}
        {generating ? "Preparing PDF…" : "Generate Emergency PDF"}
      </button>
    </Card>
  );
}

export default VitalInfoCard;

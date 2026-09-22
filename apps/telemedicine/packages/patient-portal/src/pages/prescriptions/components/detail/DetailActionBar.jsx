import React from "react";
import { Download, ShoppingBag } from "lucide-react";

/* DEBUG NOTE: Prescriptions refactor - Download control now exports the prescription details as a text file. */
export function DetailActionBar({ nextDose, onDownloadPdf, onBuyNow }) {
  return (
    <div className="sabi-rxd-action-bar">
      <div>
        <div className="sabi-rxd-action-label">NEXT DOSE REMINDER</div>
        <div className="sabi-rxd-action-value">{nextDose}</div>
      </div>

      <div className="sabi-rxd-action-buttons">
        <button className="sabi-btn-outline" onClick={onDownloadPdf}>
          <Download size={17} strokeWidth={2} />
          Download PDF
        </button>
        <button className="sabi-btn-primary" onClick={onBuyNow}>
          <ShoppingBag size={17} strokeWidth={2} />
          Buy Now at Pharmacy
        </button>
      </div>
    </div>
  );
}

export default DetailActionBar;

import React, { useState } from "react";
import { Pill, ChevronRight } from "lucide-react";
import DrugDetailModal from "./DrugDetailModal";

export function MedicationsInPrescriptionCard({ items }) {
  const [activeItem, setActiveItem] = useState(null);

  if (!items?.length) return null;

  return (
    <div className="sabi-rxd-meds-card sabi-card">
      <div className="sabi-rxd-meds-head">
        <h3>Medications in this Prescription</h3>
        <span>{items.length} item{items.length > 1 ? "s" : ""}</span>
      </div>

      <ul className="sabi-rxd-meds-list">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="sabi-rxd-meds-row"
              onClick={() => setActiveItem(item)}
            >
              <span className="sabi-rxd-meds-icon">
                <Pill size={16} />
              </span>
              <div>
                <strong>{item.name}</strong>
                <span>{item.dosage} · {item.qty}</span>
              </div>
              <ChevronRight size={17} className="sabi-rxd-meds-chevron" />
            </button>
          </li>
        ))}
      </ul>

      {items.length > 1 && (
        <p className="sabi-rxd-meds-note">
          All {items.length} medications above are sent together as one prescription when you buy at a pharmacy —
          each pharmacy will quote you on what they have in stock. Tap a medication to see what it's for.
        </p>
      )}

      <DrugDetailModal item={activeItem} onClose={() => setActiveItem(null)} />
    </div>
  );
}

export default MedicationsInPrescriptionCard;

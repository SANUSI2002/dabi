import React, { useEffect, useState } from "react";
import { CheckCircle2, Star, TriangleAlert } from "lucide-react";
import { isFavoritePharmacy, toggleFavoritePharmacy, subscribeToFavorites } from "../../pharmacy-market/favoritesStore";

function SelectPharmacyCard({ pharmacy, checked, onToggle }) {
  const available = pharmacy.availability === "available";
  const [favorite, setFavorite] = useState(() => isFavoritePharmacy(pharmacy.id));

  useEffect(() => subscribeToFavorites(() => setFavorite(isFavoritePharmacy(pharmacy.id))), [pharmacy.id]);

  return (
    <label className={`sabi-market-pharmacy sabi-card sabi-select-pharmacy ${checked ? "selected" : ""}`}>
      <input type="checkbox" checked={checked} onChange={() => onToggle(pharmacy)} />

      <div className="sabi-select-pharmacy-check" aria-hidden="true">
        <CheckCircle2 size={20} />
      </div>

      <div className="sabi-select-pharmacy-body">
        <div className="sabi-market-pharmacy-head">
          <div>
            <h2>
              {pharmacy.name}
              <button
                type="button"
                className={`sabi-pharmacy-favorite-btn${favorite ? " active" : ""}`}
                aria-label={favorite ? `Remove ${pharmacy.name} from favorites` : `Save ${pharmacy.name} as favorite`}
                onClick={(e) => { e.preventDefault(); toggleFavoritePharmacy(pharmacy.id); }}
              >
                <Star size={15} fill={favorite ? "currentColor" : "none"} />
              </button>
            </h2>
            <div className="sabi-market-rating">
              ★ {pharmacy.rating}
              <span />
              {pharmacy.distance}
            </div>
          </div>
          <span className={`sabi-market-hours ${pharmacy.status.includes("24") ? "open" : ""}`}>
            {pharmacy.status}
          </span>
        </div>

        <div className={`sabi-market-stock ${available ? "available" : "limited"}`}>
          {available ? <CheckCircle2 size={18} /> : <TriangleAlert size={18} />}
          <span>
            {available ? `Est. delivery ${pharmacy.delivery}` : `Limited stock · ${pharmacy.delivery} delivery`}
          </span>
        </div>
      </div>
    </label>
  );
}

export function SelectPharmacyList({ pharmacies, selectedIds, onToggle }) {
  return (
    <section className="sabi-market-list">
      {pharmacies.map((pharmacy) => (
        <SelectPharmacyCard
          key={pharmacy.id}
          pharmacy={pharmacy}
          checked={selectedIds.includes(pharmacy.id)}
          onToggle={onToggle}
        />
      ))}
    </section>
  );
}

export default SelectPharmacyList;

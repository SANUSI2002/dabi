import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Siren, ShieldAlert, ShoppingCart, CheckCircle2 } from "lucide-react";

import "../../styles/share.css";
import "./PharmacyMarket.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { formatNaira } from "../../utils/currency";
import { Sidebar, Topbar } from "../dashboard/components";
import { useApiData } from "../../api/useApiData";
import { getProfile } from "../../api/profileApi";
import { CONDITION_EMERGENCY_DRUGS } from "./marketFlowsData";
import { getCartCount } from "./cartStore";

function matchConditions(conditions) {
  const lower = conditions.map((c) => c.toLowerCase());
  return CONDITION_EMERGENCY_DRUGS.filter((group) =>
    lower.some((c) => c.includes(group.keyword))
  );
}

export function EmergencyMedsPage() {
  const [zoom] = useZoom();
  const navigate = useNavigate();
  const [added, setAdded] = useState(() => new Set());
  const [toast, setToast] = useState("");
  const [cartCount, setCartCount] = useState(getCartCount);

  // Conditions come from the chronic conditions the patient saved on their profile.
  const { data: profile } = useApiData(getProfile, []);
  const conditions = useMemo(
    () => (profile?.form.chronicConditions || "").split(/[,;\n]/).map((c) => c.trim()).filter(Boolean),
    [profile]
  );
  const matchedGroups = useMemo(() => matchConditions(conditions), [conditions]);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  // Marketplace checkout isn't open yet; prescriptions are ordered from Prescriptions.
  const addDrug = () => notify("Buying over-the-counter items is coming soon. Your doctor's prescriptions can already be ordered from Prescriptions.");

  const addAllForGroup = (group) => {
    group.drugs.forEach(addDrug);
  };

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main sabi-storefront-main">
        <Topbar placeholder="Search medicines, pharmacies..." />

        <button className="sabi-rxd-back" onClick={() => navigate("/pharmacy-market")}>
          <ArrowLeft size={18} /> Back to Marketplace
        </button>

        <div className="sabi-fam-header" style={{ marginTop: 12 }}>
          <div>
            <h1 style={{ color: "var(--sabi-danger)", fontSize: "1.5rem", fontWeight: 800, margin: "0 0 4px" }}>
              <Siren size={22} style={{ verticalAlign: "-4px", marginRight: 8 }} />
              Emergency Meds
            </h1>
            <p style={{ margin: 0, color: "var(--sabi-text-secondary)" }}>
              Based on the medical conditions on your Emergency ID, here are the medications you may need on hand.
            </p>
          </div>
          {cartCount > 0 && (
            <div className="sabi-fam-header-actions">
              <button type="button" className="sabi-btn-outline" onClick={() => navigate("/cart")}>
                <ShoppingCart size={16} /> View Cart ({cartCount})
              </button>
            </div>
          )}
        </div>

        <div className="sabi-fam-info-box" style={{ marginBottom: 20, background: "#FEF2F2", color: "var(--sabi-danger)" }}>
          <ShieldAlert size={16} />
          <span>
            Conditions on file: <strong>{profile ? conditions.join(", ") || "None recorded" : "Loading…"}</strong>.
            {" "}Update these from your Emergency ID card if this list looks out of date.
          </span>
        </div>

        {matchedGroups.length === 0 ? (
          <div className="sabi-card sabi-empty-state">
            <Siren size={40} />
            <h3>No emergency medications matched</h3>
            <p>We couldn&apos;t match your recorded conditions to a known emergency drug set yet. Update your medical conditions on your Emergency ID to see personalized recommendations here.</p>
          </div>
        ) : (
          matchedGroups.map((group) => (
            <div className="sabi-card sabi-cart-group" key={group.keyword}>
              <div className="sabi-cart-group-head">
                <h3><ShieldAlert size={16} style={{ color: "var(--sabi-danger)" }} /> For {group.condition}</h3>
                <button type="button" className="sabi-btn-ghost" onClick={() => addAllForGroup(group)}>
                  Add all to cart
                </button>
              </div>

              <div className="sabi-emergency-drug-grid">
                {group.drugs.map((drug) => {
                  const isAdded = added.has(drug.id);
                  return (
                    <div className="sabi-emergency-drug-card" key={drug.id}>
                      <img src={drug.photo} alt={drug.name} />
                      <div className="sabi-emergency-drug-body">
                        <span className="cat">{drug.category}</span>
                        <strong>{drug.name}</strong>
                        <p>{drug.note}</p>
                        <div className="sabi-emergency-drug-footer">
                          <span className="price">{formatNaira(drug.price)}</span>
                          <button
                            type="button"
                            className={isAdded ? "sabi-btn-outline" : "sabi-btn-primary"}
                            onClick={() => addDrug(drug)}
                          >
                            {isAdded ? <><CheckCircle2 size={14} /> Added</> : <><ShoppingCart size={14} /> Add</>}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {toast && <div className="sabi-toast">{toast}</div>}
      </div>
    </div>
  );
}

export default EmergencyMedsPage;

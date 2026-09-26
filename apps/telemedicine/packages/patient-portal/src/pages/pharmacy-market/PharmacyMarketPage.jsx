import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Baby,
    CheckCircle2,
    Citrus,
    FileText,
    Leaf,
    History,
    Pill,
    RotateCw,
    ShieldCheck,
    Siren,
    Star,
    Stethoscope,
    Syringe,
    UploadCloud,
} from "lucide-react";

import "../../styles/share.css";
import "./PharmacyMarket.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";

import { Sidebar, Topbar } from "../dashboard/components";
import { QUICK_ACTIONS, CATEGORIES, getMarketplacePharmacies } from "./marketplaceData";
import { openExternalDirections } from "../../utils/mapUtils";

const ICONS = {
    UploadCloud, RotateCw, Siren, History,
    FileText, Pill, Baby, Stethoscope, Leaf, ShieldCheck, Citrus, Syringe,
};

export function PharmacyMarketPage() {
    const [zoom] = useZoom();
    const navigate = useNavigate();
    const [activeCategory, setActiveCategory] = useState("");
    const [toast, setToast] = useState("");
    const pharmacies = getMarketplacePharmacies();

    const notify = (message) => {
        setToast(message);
        window.setTimeout(() => setToast(""), 2400);
    };

    const handleQuickAction = (action) => {
        if (action.key === "prescription") {
            navigate("/pharmacy-market/prescription");
            return;
        }
        if (action.key === "refill") {
            navigate("/pharmacy-market/refill");
            return;
        }
        if (action.key === "emergency") {
            navigate("/pharmacy-market/emergency-meds");
            return;
        }
        navigate("/pharmacy-market/repeat-last-order");
    };

    return (
        <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
            <Sidebar />

            <div className="sabi-main sabi-storefront-main">
                <Topbar placeholder="Search medicines, pharmacies, or health brands..." />

                <section className="sabi-storefront-hero">
                    <h1>Order Medicines &amp; Healthcare Essentials</h1>
                    <p>
                        Shop from trusted pharmacies near you with fast delivery or convenient pickup.
                        Sabi Health ensures every dose is verified and delivered with care.
                    </p>
                    {/* Over-the-counter checkout isn't open yet; prescriptions are already live. */}
                    <p>
                        <strong>Coming soon:</strong> buying over-the-counter items here. Your doctor&apos;s prescriptions can
                        already be ordered from Prescriptions.
                    </p>
                    <div className="sabi-storefront-hero-actions">
                        <button
                            type="button"
                            className="sabi-storefront-hero-primary"
                            onClick={() =>
                                document.getElementById("storefront-pharmacies")?.scrollIntoView({ behavior: "smooth" })
                            }
                        >
                            Start Shopping
                        </button>
                        {/* DEBUG NOTE: Connected location click handler to trigger directions. */}
                        <button type="button" className="sabi-storefront-hero-outline" onClick={() => openExternalDirections(pharmacies[0]?.lat, pharmacies[0]?.lng, pharmacies[0]?.name)}>
                            Find Nearby Stores
                        </button>
                    </div>
                </section>

                <section className="sabi-storefront-quick-actions">
                    {QUICK_ACTIONS.map((action) => {
                        const Icon = ICONS[action.icon] || Pill;
                        return (
                            <button
                                key={action.key}
                                type="button"
                                className={`sabi-storefront-quick-action tone-${action.tone}`}
                                onClick={() => handleQuickAction(action)}
                            >
                                <span>
                                    <Icon size={20} />
                                </span>
                                {action.label}
                            </button>
                        );
                    })}
                </section>

                <section className="sabi-storefront-section">
                    <div className="sabi-storefront-section-head">
                        <h2>Shop by Category</h2>
                        <button type="button" onClick={() => notify("Showing all categories")}>View All →</button>
                    </div>

                    <div className="sabi-storefront-categories">
                        {CATEGORIES.map((cat) => {
                            const Icon = ICONS[cat.icon] || Pill;
                            const active = activeCategory === cat.key;
                            return (
                                <button
                                    key={cat.key}
                                    type="button"
                                    className={`sabi-storefront-category ${active ? "active" : ""}`}
                                    onClick={() => {
                                        setActiveCategory(active ? "" : cat.key);
                                        notify(`Browsing ${cat.label}`);
                                    }}
                                >
                                    <span>
                                        <Icon size={20} />
                                    </span>
                                    {cat.label}
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className="sabi-storefront-section" id="storefront-pharmacies">
                    <div className="sabi-storefront-section-head">
                        <h2>Featured Pharmacies</h2>
                    </div>

                    <div className="sabi-storefront-pharmacies">
                        {pharmacies.map((pharmacy) => (
                            <article key={pharmacy.id} className="sabi-storefront-pharmacy-card sabi-card">
                                <div className="sabi-storefront-pharmacy-photo">
                                    <img src={pharmacy.photo} alt={pharmacy.name} />
                                    <span><Star size={12} fill="currentColor" /> {pharmacy.rating}</span>
                                </div>
                                <div className="sabi-storefront-pharmacy-body">
                                    <h3>{pharmacy.name}</h3>
                                    <p>{pharmacy.delivery}</p>
                                    <div className="sabi-storefront-pharmacy-tags">
                                        {pharmacy.tags.map((tag) => (
                                            <span key={tag} className={tag.toLowerCase().includes("emergency") ? "danger" : ""}>
                                                <CheckCircle2 size={12} /> {tag}
                                            </span>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        className="sabi-storefront-visit"
                                        onClick={() => navigate(`/pharmacy-market/${pharmacy.id}`)}
                                    >
                                        Visit Store
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="sabi-storefront-promos">
                    <div className="sabi-storefront-promo">
                        <div>
                            <h3>First Order Discount</h3>
                            <p>Get 20% off on your first medicine order from Sabi Premium.</p>
                            <span className="sabi-storefront-promo-code">CODE: SABI20</span>
                        </div>
                    </div>
                    <div className="sabi-storefront-promo alt">
                        <div>
                            <h3>Subscription Benefits</h3>
                            <p>Free delivery on all monthly refill subscriptions.</p>
                            <button type="button" onClick={() => notify("Opening subscription details…")}>Learn More →</button>
                        </div>
                    </div>
                </section>

                {toast && <div className="sabi-toast">{toast}</div>}
            </div>
        </div>
    );
}

export default PharmacyMarketPage;

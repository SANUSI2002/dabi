import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock, MapPin, ShieldCheck, ShoppingCart, Star, Plus, Minus } from "lucide-react";

import "../../styles/share.css";
import "./PharmacyMarket.css";
import "../prescriptions/PrescriptionDetail.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { formatNaira } from "../../utils/currency";

import { Sidebar, Topbar } from "../dashboard/components";
import { getMarketplacePharmacies } from "./marketplaceData";
import { getCartForPharmacy, setCartQty, getCartCount } from "./cartStore";
import { openExternalDirections } from "../../utils/mapUtils";

export function PharmacyStorefrontPage() {
    const [zoom] = useZoom();
    const { pharmacyId } = useParams();
    const navigate = useNavigate();
    const pharmacy = getMarketplacePharmacies().find((p) => p.id === pharmacyId);

    const [cart, setCart] = useState(() => (pharmacyId ? getCartForPharmacy(pharmacyId) : {}));
    const [totalCartCount, setTotalCartCount] = useState(getCartCount());
    const [toast, setToast] = useState("");

    useEffect(() => {
        if (pharmacyId) setCart(getCartForPharmacy(pharmacyId));
    }, [pharmacyId]);

    if (!pharmacy) {
        return (
            <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
                <Sidebar />
                <div className="sabi-main">
                    <Topbar />
                    <div className="sabi-card sabi-empty-state sabi-pharmacy-empty-state">
                        <p>We couldn&apos;t find that pharmacy.</p>
                        <button className="sabi-btn-primary" onClick={() => navigate("/pharmacy-market")}>
                            Back to Marketplace
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const cartItemCount = Object.values(cart).reduce((s, qty) => s + qty, 0);

    const notify = (message) => {
        setToast(message);
        window.setTimeout(() => setToast(""), 2000);
    };

    // Marketplace checkout isn't open yet; prescriptions are ordered from Prescriptions.
    const addOne = () => notify("Buying over-the-counter items is coming soon. Your doctor's prescriptions can already be ordered from Prescriptions.");

    const changeQty = (product, delta) => {
        const currentQty = cart[product.id] || 0;
        const nextQty = Math.max(0, currentQty + delta);
        const next = setCartQty(pharmacy.id, product.id, nextQty);
        setCart(next[pharmacy.id] || {});
        setTotalCartCount(getCartCount());
    };

    return (
        <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
            <Sidebar />

            <div className="sabi-main sabi-storefront-main">
                <Topbar placeholder="Search medicines..." />

                <button className="sabi-rxd-back" onClick={() => navigate("/pharmacy-market")}>
                    <ArrowLeft size={18} strokeWidth={2} /> Back to Marketplace
                </button>

                <div className="sabi-store-banner">
                    <img src={pharmacy.photo} alt={pharmacy.name} />
                </div>

                <div className="sabi-store-header sabi-card">
                    <div>
                        <h1>{pharmacy.name} <CheckCircle2 size={18} /></h1>
                        {/* DEBUG NOTE: Connected location click handler to trigger directions. */}
                        <button type="button" className="sabi-store-address-link" onClick={() => openExternalDirections(pharmacy.lat, pharmacy.lng, pharmacy.name)}>
                            <Star size={15} fill="currentColor" /> {pharmacy.rating}
                            <span className="sabi-store-dot" />
                            <MapPin size={15} /> {pharmacy.address}
                        </button>
                    </div>
                    <button
                        type="button"
                        className="sabi-store-header-cart"
                        style={{ border: "none", cursor: "pointer" }}
                        onClick={() => navigate("/cart")}
                    >
                        <ShoppingCart size={18} /> {cartItemCount} in this store
                        {totalCartCount > cartItemCount && (
                            <span style={{ opacity: 0.7, fontWeight: 600 }}>&nbsp;· {totalCartCount} total</span>
                        )}
                    </button>
                </div>

                <div className="sabi-store-layout">
                    <aside className="sabi-store-side">
                        <div className="sabi-card sabi-store-trust">
                            <h3><ShieldCheck size={16} /> Clinical Trust</h3>
                            <div className="sabi-store-pharmacist">
                                <strong>{pharmacy.pharmacist.name}</strong>
                                <span>{pharmacy.pharmacist.title}</span>
                            </div>
                            <dl>
                                <div><dt>Pharmacy License</dt><dd>{pharmacy.license}</dd></div>
                            </dl>
                        </div>

                        <div className="sabi-card sabi-store-hours">
                            <h3><Clock size={16} /> Hours</h3>
                            <div><span>Mon - Fri</span><strong>{pharmacy.hours.weekday}</strong></div>
                            <div><span>Sat - Sun</span><strong>{pharmacy.hours.weekend}</strong></div>
                        </div>

                        <div className="sabi-card sabi-store-insurance">
                            <h3>Insurance Partners</h3>
                            <div className="sabi-store-insurance-list">
                                {pharmacy.insurance.map((name) => (
                                    <span key={name}>{name}</span>
                                ))}
                            </div>
                        </div>
                    </aside>

                    <section className="sabi-store-products">
                        {pharmacy.products.map((product) => {
                            const qty = cart[product.id] || 0;
                            return (
                                <article key={product.id} className="sabi-card sabi-store-product">
                                    {product.tag && <span className="sabi-store-product-tag">{product.tag}</span>}
                                    <img src={product.photo} alt={product.name} />
                                    <span className="sabi-store-product-category">{product.category}</span>
                                    <h4>{product.name}</h4>
                                    <div className="sabi-store-product-footer">
                                        <strong>{formatNaira(product.price)}</strong>
                                        {qty === 0 ? (
                                            <button type="button" onClick={() => addOne(product)} aria-label={`Add ${product.name} to cart`}>
                                                <ShoppingCart size={16} />
                                            </button>
                                        ) : (
                                            <div className="sabi-stepper">
                                                <button type="button" onClick={() => changeQty(product, -1)} aria-label="Decrease quantity">
                                                    <Minus size={13} />
                                                </button>
                                                <span>{qty}</span>
                                                <button type="button" onClick={() => changeQty(product, 1)} aria-label="Increase quantity">
                                                    <Plus size={13} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </section>
                </div>

                {toast && <div className="sabi-toast">{toast}</div>}
            </div>
        </div>
    );
}

export default PharmacyStorefrontPage;

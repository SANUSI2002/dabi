import React, { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, PackageSearch, Sparkles } from "lucide-react";
import "../../styles/share.css";
import "./PharmacyQuotes.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";

import { Sidebar, Topbar } from "../dashboard/components";
import { PharmacyInvoice, QuoteList, ChatModal } from "./components";

import { QUOTES } from "./data";
import { getExpiryInfo } from "./expiry";
import { computeSavings } from "./pricing";
import { getPrescriptionDetail, getSentAt } from "../prescriptions/prescriptionStore";
import { addQuoteItemsToCart } from "../pharmacy-market/cartStore";
import { formatNaira } from "../../utils/currency";

export function PharmacyQuotesPage() {
    const [zoom] = useZoom();
    const { id } = useParams();
    const { state } = useLocation();
    const navigate = useNavigate();

    const detail = getPrescriptionDetail(id);

    // Only show quotes from pharmacies the prescription was actually sent
    // to (passed via SelectPharmacyPage's navigate state). Fall back to
    // the full list when opened without that context (e.g. from the
    // Pharmacy Quotes inbox / a bookmarked link).
    const quotes = useMemo(() => {
        if (!state?.pharmacyIds?.length) return QUOTES;
        const filtered = QUOTES.filter((q) => state.pharmacyIds.includes(q.id));
        return filtered.length ? filtered : QUOTES;
    }, [state]);

    const [selectedQuote, setSelectedQuote] = useState(
        quotes.find((q) => q.best) || quotes.find((q) => q.availability !== "Out of Stock") || quotes[0]
    );
    const [toast, setToast] = useState("");
    const [chatWith, setChatWith] = useState(null);
    const [addedCount, setAddedCount] = useState(0);

    const notify = (message) => {
        setToast(message);
        window.setTimeout(() => setToast(""), 2600);
    };

    const expiry = useMemo(() => getExpiryInfo(getSentAt(id)), [id]);

    if (!detail) {
        return (
            <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
                <Sidebar />
                <div className="sabi-main">
                    <Topbar />
                    <div className="sabi-card">
                        <p>We couldn&apos;t find quotes for that prescription.</p>
                        <button className="sabi-btn-primary" onClick={() => navigate("/prescriptions")}>
                            Back to Prescriptions
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const respondedCount = quotes.filter((q) => q.availability !== "Out of Stock").length;
    const allOutOfStock = quotes.length > 0 && respondedCount === 0;
    const savings = useMemo(() => computeSavings(detail.items, quotes), [detail.items, quotes]);

    const handleAddToCart = ({ pharmacyId, pharmacyName, items, deliveryMode, deliveryFee, serviceCharge, vat }) => {
        addQuoteItemsToCart({ id: pharmacyId, name: pharmacyName }, items, { deliveryMode, deliveryFee, serviceCharge, vat });
        setAddedCount((c) => c + items.length);
        notify(`${items.length} item${items.length === 1 ? "" : "s"} from ${pharmacyName} added to your order`);
    };

    return (
        <div
            className="sabi-dashboard"
            style={{ ...pageVars, zoom }}
        >
            <Sidebar />

            <main className="sabi-main sabi-quotes-main">
                <Topbar placeholder="Search for medications or pharmacies..." />

                <button className="sabi-rxd-back" onClick={() => navigate(`/prescriptions/${id}`)}>
                    <ArrowLeft size={18} /> Back to Prescription
                </button>

                <header className="sabi-quotes-header">
                    <p>
                        Pharmacy <span>›</span> <strong>Responses</strong>
                    </p>

                    <h1>Pharmacy Quotes &amp; Invoices</h1>
                    <h2>{respondedCount} response{respondedCount === 1 ? "" : "s"} received for {detail.name}</h2>

                    {expiry.label && (
                        <span className={`sabi-quotes-expiry-pill${expiry.expired ? " expired" : ""}`}>
                            {expiry.label}
                        </span>
                    )}
                </header>

                {allOutOfStock ? (
                    <div className="sabi-card sabi-empty-state">
                        <PackageSearch size={40} />
                        <h3>No selected pharmacy currently has your prescription available.</h3>
                        <p>Try expanding your search radius or sending the prescription to more pharmacies.</p>
                        <button
                            type="button"
                            className="sabi-btn-primary"
                            style={{ marginTop: 8 }}
                            onClick={() => navigate(`/prescriptions/${id}/select-pharmacy`)}
                        >
                            <MapPin size={15} /> Expand Search &amp; Resend
                        </button>
                    </div>
                ) : (
                    <>
                        {addedCount > 0 && (
                            <div className="sabi-quotes-cart-banner">
                                <span>{addedCount} item{addedCount === 1 ? "" : "s"} added to your order so far — you can keep adding from other pharmacies below.</span>
                                <button type="button" className="sabi-btn-primary" onClick={() => navigate("/cart")}>
                                    Go to Cart
                                </button>
                            </div>
                        )}

                        {savings && savings.savings > 0 && (
                            <div className="sabi-quotes-savings-banner">
                                <Sparkles size={16} />
                                <span>
                                    <strong>Smart Savings:</strong> Splitting this prescription across the cheapest pharmacy per
                                    drug could save you <strong>{formatNaira(savings.savings)}</strong> compared to buying
                                    everything from {savings.singleBestPharmacy} alone.
                                </span>
                            </div>
                        )}

                        <div className="sabi-quotes-layout">
                            <QuoteList
                                quotes={quotes}
                                selectedId={selectedQuote?.id}
                                onSelect={setSelectedQuote}
                            />

                            {selectedQuote && (
                                <PharmacyInvoice
                                    detail={detail}
                                    quote={selectedQuote}
                                    allQuotes={quotes}
                                    expired={expiry.expired}
                                    onAddToCart={handleAddToCart}
                                    onOpenChat={() => setChatWith(selectedQuote)}
                                />
                            )}
                        </div>
                    </>
                )}

                {chatWith && (
                    <ChatModal
                        prescriptionId={id}
                        pharmacyId={chatWith.id}
                        pharmacyName={chatWith.name}
                        onClose={() => setChatWith(null)}
                    />
                )}

                {toast && <div className="sabi-toast">{toast}</div>}
            </main>
        </div>
    );
}

export default PharmacyQuotesPage;

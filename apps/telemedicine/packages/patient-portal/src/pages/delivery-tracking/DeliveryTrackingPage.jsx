import React, { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import "../../styles/share.css";
import "./DeliveryTracking.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import {
    DeliveryMap,
    JourneyCard,
    OrderSummary,
    PharmacyCard
} from "./components";

import { getDelivery } from "./data";
import { useApiData } from "../../api/useApiData";
import { validateCoordinates } from "../../utils/mapUtils";

export function DeliveryTrackingPage() {
    const [zoom] = useZoom();
    const { orderId } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const hasDestinationQuery = searchParams.has("lat") && searchParams.has("lng");
    const destinationCoordinates = validateCoordinates(searchParams.get("lat"), searchParams.get("lng"));

    const loaded = useApiData(() => getDelivery(orderId), [orderId]);
    // Tracking updates as the pharmacy and rider move the order along.
    useEffect(() => {
        const timer = window.setInterval(() => loaded.reload(), 20000);
        return () => window.clearInterval(timer);
    }, [orderId]);

    if (!loaded.data) {
        return (
            <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
                <Sidebar />
                <div className="sabi-main">
                    <Topbar />
                    <div className="sabi-card">
                        <p>{loaded.error ? "We couldn't find that delivery." : "Loading your delivery…"}</p>
                        <button className="sabi-btn-primary" onClick={() => navigate("/delivery-tracking")}>
                            Back to Deliveries
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const { order, steps, items, deliveryFee } = loaded.data;

    return (
        <div
            className="sabi-dashboard"
            style={{ ...pageVars, zoom }}
        >
            <Sidebar />

            <main className="sabi-main sabi-delivery-main">
                <Topbar placeholder="Search orders, meds..." />

                <button className="sabi-rxd-back" onClick={() => navigate("/delivery-tracking")}>
                    <ArrowLeft size={18} /> Back to Deliveries
                </button>

                <header className="sabi-delivery-header">
                    <span>◎</span>
                    Delivery Tracking · Order #{order.id}
                </header>

                <div className="sabi-delivery-layout">
                    <section>
                        {/* DEBUG NOTE: Connected URL coordinates to update the active delivery map marker. */}
                        <DeliveryMap order={order} initialDestination={hasDestinationQuery ? destinationCoordinates : undefined} />
                    </section>

                    <aside>
                        <JourneyCard steps={steps} />
                        <PharmacyCard order={order} />
                        <OrderSummary items={items} deliveryFee={deliveryFee} />
                    </aside>
                </div>
            </main>
        </div>
    );
}

export default DeliveryTrackingPage;

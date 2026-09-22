import React from "react";
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

import { ACTIVE_DELIVERIES, DELIVERY_JOURNEYS, DELIVERY_ITEMS, genericJourneyFor } from "./data";
import { getOrders } from "../pharmacy-market/cartStore";
import { formatNaira } from "../../utils/currency";
import { validateCoordinates } from "../../utils/mapUtils";

function findCheckoutOrder(orderId) {
    return getOrders().find((o) => o.id.replace(/^SH-/, "") === orderId) || null;
}

export function DeliveryTrackingPage() {
    const [zoom] = useZoom();
    const { orderId } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const hasDestinationQuery = searchParams.has("lat") && searchParams.has("lng");
    const destinationCoordinates = validateCoordinates(searchParams.get("lat"), searchParams.get("lng"));

    const known = ACTIVE_DELIVERIES.find((d) => d.id === orderId);
    const checkoutOrder = !known ? findCheckoutOrder(orderId) : null;

    if (!known && !checkoutOrder) {
        return (
            <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
                <Sidebar />
                <div className="sabi-main">
                    <Topbar />
                    <div className="sabi-card">
                        <p>We couldn&apos;t find that delivery.</p>
                        <button className="sabi-btn-primary" onClick={() => navigate("/delivery-tracking")}>
                            Back to Deliveries
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const order = known || {
        id: orderId,
        eta: checkoutOrder.status === "Delivered" ? "Delivered" : "Pending dispatch",
        minutes: "—",
        distance: "—",
        rider: "Not assigned yet",
        vehicle: "—",
        pharmacy: checkoutOrder.groups?.[0]?.pharmacyName || "Sabi Health Order",
        location: checkoutOrder.address?.address || "Delivery address on file",
        destinationCoordinates: validateCoordinates(checkoutOrder.address?.lat, checkoutOrder.address?.lng),
    };

    const steps = known ? DELIVERY_JOURNEYS[orderId] : genericJourneyFor(checkoutOrder.status);

    const items = known
        ? DELIVERY_ITEMS[orderId]
        : (checkoutOrder.groups || []).flatMap((g) =>
            g.items.map((item) => ({ name: item.name, detail: g.pharmacyName, price: formatNaira(item.price * item.qty) }))
          );

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
                        <OrderSummary items={items} deliveryFee={known ? undefined : checkoutOrder.deliveryFee} />
                    </aside>
                </div>
            </main>
        </div>
    );
}

export default DeliveryTrackingPage;

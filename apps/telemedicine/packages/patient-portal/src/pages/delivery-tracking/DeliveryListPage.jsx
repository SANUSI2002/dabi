import React from "react";
import { useNavigate } from "react-router-dom";
import { Bike, ChevronRight, MapPin, Package, Store } from "lucide-react";

import "../../styles/share.css";
import "./DeliveryTracking.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { listDeliveries } from "./data";
import { useApiData } from "../../api/useApiData";

export function DeliveryListPage() {
  const [zoom] = useZoom();
  const navigate = useNavigate();

  const { data, error } = useApiData(listDeliveries, []);
  const deliveries = data || [];

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <main className="sabi-main sabi-delivery-main">
        <Topbar placeholder="Search orders, meds..." />

        <header className="sabi-delivery-header">
          <span>◎</span>
          Delivery Tracking
        </header>

        {!data ? (
          <p className="sabi-rx-empty">{error ? "We couldn't load your orders. Please refresh to try again." : "Loading your orders…"}</p>
        ) : deliveries.length === 0 ? (
          <div className="sabi-card sabi-empty-state">
            <Package size={40} />
            <h3>No deliveries yet</h3>
            <p>Orders you place for your prescriptions will show up here so you can track them in real time.</p>
            <button type="button" className="sabi-btn-primary" style={{ marginTop: 8 }} onClick={() => navigate("/prescriptions")}>
              Go to Prescriptions
            </button>
          </div>
        ) : (
          <div className="sabi-delivery-list">
            {deliveries.map((d) => (
              <button
                type="button"
                key={d.id}
                className="sabi-delivery-list-item"
                onClick={() => navigate(`/delivery-tracking/${d.id}`)}
              >
                <div className="sabi-delivery-list-icon">
                  {d.statusTone === "done" ? <Package size={20} /> : <Bike size={20} />}
                </div>

                <div className="sabi-delivery-list-body">
                  <div className="sabi-delivery-list-top">
                    <strong>Order #{d.reference}</strong>
                    <span className={`sabi-delivery-status-pill ${d.statusTone}`}>{d.status}</span>
                  </div>
                  <div className="sabi-delivery-list-meta">
                    <span><Store size={13} /> {d.pharmacy}</span>
                    <span><MapPin size={13} /> {d.location}</span>
                  </div>
                  <div className="sabi-delivery-list-items">{d.itemsSummary} · {d.total}</div>
                </div>

                <div className="sabi-delivery-list-trail">
                  <span>{d.eta}</span>
                  <ChevronRight size={18} />
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default DeliveryListPage;

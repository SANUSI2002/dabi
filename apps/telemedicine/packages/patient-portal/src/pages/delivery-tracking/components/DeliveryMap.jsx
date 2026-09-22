import React, { useState } from "react";
import { Bike, MessageSquare, Phone, Truck } from "lucide-react";
import { HealthMap } from "../../../map/Map";
import { validateCoordinates } from "../../../utils/mapUtils";

export function DeliveryMap({ order, initialDestination }) {
  const destination = validateCoordinates(...(initialDestination || order.destinationCoordinates || [6.4541, 3.3947]));
  const pharmacy = validateCoordinates(...(order.pharmacyCoordinates || [6.4488, 3.4015]));
  const courier = validateCoordinates(...(order.courierCoordinates || [6.4516, 3.3982]));
  const [activeLocation, setActiveLocation] = useState("courier");
  const center = activeLocation === "destination" ? destination : activeLocation === "pharmacy" ? pharmacy : courier;

  return <>
    <section className="sabi-delivery-map sabi-card">
      {/*
       * DEBUG/MAINTENANCE NOTE:
       * Replaced the CSS-drawn delivery route/map placeholder with interactive <HealthMap /> from src/map.
       * Coordinates originate from order geolocation fields or URL search parameters; safe Lagos fallbacks are used otherwise.
       * Note: Map container requires an explicit height (.sabi-delivery-interactive-map) for Leaflet tiles.
       */}
      <HealthMap
        key={`${order.id}-${activeLocation}-${center.join(",")}`}
        center={center}
        zoom={14}
        markers={[
          { id: `${order.id}-pharmacy`, lat: pharmacy[0], lng: pharmacy[1], title: order.pharmacy, subtitle: "Pickup location" },
          { id: `${order.id}-courier`, lat: courier[0], lng: courier[1], title: order.rider, subtitle: "Courier location" },
          { id: `${order.id}-destination`, lat: destination[0], lng: destination[1], title: "Delivery destination" },
        ]}
        className="sabi-delivery-interactive-map w-full rounded-none border-0"
      />
      <div className="sabi-delivery-order">Order {order.id}</div>
      <div className="sabi-delivery-eta"><span><Truck /></span><div><small>ESTIMATED ARRIVAL</small><strong>{order.eta}</strong> <em>({order.minutes})</em></div></div>
      <div className="sabi-delivery-status"><span><Bike /></span><div><h1>Heading to your location</h1><p>{order.rider} is {order.distance} away from you</p></div>
        {/* DEBUG NOTE: Connected location click handler to update the active map marker. */}
        <button type="button" onClick={() => setActiveLocation("destination")}>Track Details</button>
      </div>
    </section>
    <section className="sabi-delivery-rider sabi-card"><div className="sabi-delivery-avatar">AS</div><div><h2>{order.rider} <em>★ 4.9</em></h2><p>{order.vehicle}</p><small>Sabi Certified Logistics Partner</small></div><div className="sabi-delivery-contact"><button><MessageSquare /> Chat</button><button><Phone /> Call</button></div></section>
  </>;
}

import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Fix default marker icon paths in bundlers (Vite / Webpack)
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
});

export const HealthMap = ({
  center = [9.0765, 7.3986], // Default center (e.g. Abuja)
  zoom = 13,
  markers = [],
  className = "h-64 w-full rounded-xl border border-gray-200 overflow-hidden shadow-sm"
}) => {
  const mapCenter = center || (markers.length > 0 ? [markers[0].lat, markers[0].lng] : [9.0765, 7.3986]);

  return (
    <div className={`relative ${className}`}>
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        scrollWheelZoom={false}
        className="h-full w-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((point) => (
          <Marker key={point.id} position={[point.lat, point.lng]}>
            {(point.title || point.subtitle || point.description) && (
              <Popup>
                <div className="p-1 min-w-[140px]">
                  {point.title && <h4 className="font-semibold text-gray-900 text-xs">{point.title}</h4>}
                  {point.subtitle && <p className="text-[11px] text-emerald-600 font-medium mt-0.5">{point.subtitle}</p>}
                  {point.description && <p className="text-[11px] text-gray-500 mt-1">{point.description}</p>}
                </div>
              </Popup>
            )}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};
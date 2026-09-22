import React from "react";
import { Card } from "design-system";
import { Building2, MapPin } from "lucide-react";
import { SectionTitle } from "../../dashboard/share";
import { NEARBY_HEALTHCARE } from "../data";
import { openExternalDirections } from "../../../utils/mapUtils";

export function NearbyHealthcare() {
  return (
    <section>
      {/* DEBUG NOTE: Connected location click handler to trigger directions for the nearest facility. */}
      <SectionTitle action="Explore Map" onAction={() => openExternalDirections(NEARBY_HEALTHCARE[0]?.lat, NEARBY_HEALTHCARE[0]?.lng, NEARBY_HEALTHCARE[0]?.name)}>Nearby Healthcare</SectionTitle>
      <div className="sabi-nearby-grid">
        {NEARBY_HEALTHCARE.map((place) => (
          <Card key={place.name} className="sabi-nearby-card">
            <div className="sabi-nearby-thumb">
              <Building2 size={26} />
            </div>
            <div className="sabi-nearby-name">{place.name}</div>
            <div className="sabi-nearby-distance">
              <MapPin size={12} /> {place.distance}
            </div>
            <div className="sabi-nearby-tags">
              {place.tags.map((t) => (
                <span key={t} className="sabi-nearby-tag">
                  {t}
                </span>
              ))}
            </div>
            {/* DEBUG NOTE: Connected location click handler to trigger directions. */}
            <button type="button" className="sabi-apt-view-btn" onClick={() => openExternalDirections(place.lat, place.lng, place.name)}>Get Directions</button>
          </Card>
        ))}
      </div>
    </section>
  );
}

export default NearbyHealthcare;

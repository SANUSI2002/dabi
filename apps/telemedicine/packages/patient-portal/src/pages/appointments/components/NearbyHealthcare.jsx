import React from "react";
import { Card } from "design-system";
import { Building2, MapPin } from "lucide-react";
import { SectionTitle } from "../../dashboard/share";
import { useApiData } from "../../../api/useApiData";
import { listHospitals } from "../../../api/sabiApi";
import { mapsSearchUrl } from "../../../api/doctorsApi";

// Verified hospitals from the Sabi directory; directions open the facility's address in Maps.
const openDirections = (place) => place?.address && window.open(mapsSearchUrl(place.address), "_blank", "noopener,noreferrer");

export function NearbyHealthcare() {
  const { data } = useApiData(() => listHospitals({ limit: 4 }), []);
  const NEARBY_HEALTHCARE = (data?.items || []).map((h) => ({ ...h, distance: h.area || h.address, tags: [h.typeLabel] }));
  if (!NEARBY_HEALTHCARE.length) return null;

  return (
    <section>
      <SectionTitle action="Explore Map" onAction={() => openDirections(NEARBY_HEALTHCARE[0])}>Nearby Healthcare</SectionTitle>
      <div className="sabi-nearby-grid">
        {NEARBY_HEALTHCARE.map((place) => (
          <Card key={place.id} className="sabi-nearby-card">
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
            <button type="button" className="sabi-apt-view-btn" onClick={() => openDirections(place)}>Get Directions</button>
          </Card>
        ))}
      </div>
    </section>
  );
}

export default NearbyHealthcare;

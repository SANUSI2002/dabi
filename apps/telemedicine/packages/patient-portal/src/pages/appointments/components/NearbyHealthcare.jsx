import React from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "design-system";
import { Building2, MapPin } from "lucide-react";
import { SectionTitle } from "../../dashboard/share";
import { useApiData } from "../../../api/useApiData";
import { listHospitals } from "../../../api/sabiApi";
import { mapsSearchUrl } from "../../../api/doctorsApi";

/** Verified hospitals from the Sabi directory (not a distance-sorted list: facilities don't publish coordinates). */
export function NearbyHealthcare() {
  const navigate = useNavigate();
  const { data, error } = useApiData(() => listHospitals({ limit: 4 }), []);
  const hospitals = data?.items || [];
  if (error || !hospitals.length) return null;

  return (
    <section>
      <SectionTitle action="All Hospitals" onAction={() => navigate("/hospitals")}>Verified Hospitals</SectionTitle>
      <div className="sabi-nearby-grid">
        {hospitals.map((place) => (
          <Card key={place.id} className="sabi-nearby-card">
            <div className="sabi-nearby-thumb">
              <Building2 size={26} />
            </div>
            <div className="sabi-nearby-name">{place.name}</div>
            {place.area && (
              <div className="sabi-nearby-distance">
                <MapPin size={12} /> {place.area}
              </div>
            )}
            <div className="sabi-nearby-tags">
              <span className="sabi-nearby-tag">{place.typeLabel}</span>
            </div>
            <div className="sabi-nearby-actions">
              <button type="button" className="sabi-apt-view-btn" onClick={() => navigate(`/hospitals/${place.id}`)}>View</button>
              {place.address && (
                <a className="sabi-apt-secondary-btn" href={mapsSearchUrl(place.address)} target="_blank" rel="noopener noreferrer">Directions</a>
              )}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

export default NearbyHealthcare;

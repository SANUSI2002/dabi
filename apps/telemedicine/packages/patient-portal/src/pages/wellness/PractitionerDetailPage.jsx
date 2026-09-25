import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, CalendarPlus, Sparkles } from "lucide-react";

import "../../styles/share.css";
import "./Wellness.css";

import { useApiData } from "../../api/useApiData";
import { getWellnessOffering } from "../../api/sabiApi";
import { LoadState, PageShell, formatNaira } from "../hospitals/hospitalShared";
import { categoryLabel, initials, toOffering } from "./wellnessStore";

export function PractitionerDetailPage() {
  const { categoryId, practitionerId } = useParams();
  const navigate = useNavigate();
  const offering = useApiData(async () => toOffering(await getWellnessOffering(practitionerId)), [practitionerId]);
  const notFound = offering.error?.status === 404 || offering.error?.status === 400;
  const o = offering.data;

  return (
    <PageShell placeholder="Search wellness services..." mainClassName="sabi-main sabi-wellness-main">
      <button className="sabi-rxd-back" onClick={() => navigate(`/wellness-hub/${categoryId}`)}>
        <ArrowLeft size={18} /> Back to {categoryLabel(categoryId)}
      </button>

      {notFound ? (
        <div className="sabi-card sabi-live-state">
          <Sparkles size={32} />
          <h3>This service isn&apos;t available</h3>
          <p>It may have been withdrawn by the provider.</p>
          <button className="sabi-btn-primary" onClick={() => navigate(`/wellness-hub/${categoryId}`)}>Browse services</button>
        </div>
      ) : (
        <LoadState loading={offering.loading} error={offering.error} onRetry={offering.reload} label="Loading service…">
          {o && (
            <div className="sabi-card sabi-wellness-profile-card">
              <div className="sabi-wellness-profile-head">
                <div className="sabi-wellness-avatar" aria-hidden="true">{initials(o.providerName)}</div>
                <div>
                  <h1 style={{ margin: 0 }}>{o.name}</h1>
                  <p style={{ margin: "4px 0" }}><BadgeCheck size={15} /> {o.providerName} · Verified provider</p>
                  {o.providerDetail && <p style={{ margin: 0 }}>{o.providerDetail}</p>}
                </div>
                <div className="sabi-wellness-profile-rate">
                  <strong>{o.price > 0 ? formatNaira(o.price) : "Price on request"}</strong>
                  <span>{categoryLabel(o.category)}</span>
                </div>
              </div>
              {o.description && <p style={{ lineHeight: 1.6 }}>{o.description}</p>}
              <button type="button" className="sabi-btn-primary" onClick={() => navigate(`/wellness-hub/${categoryId}/${o.id}/book`)}>
                <CalendarPlus size={16} /> Book this service
              </button>
            </div>
          )}
        </LoadState>
      )}
    </PageShell>
  );
}

export default PractitionerDetailPage;

import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Sparkles } from "lucide-react";

import "../../styles/share.css";
import "./Wellness.css";

import { useApiData } from "../../api/useApiData";
import { listWellnessOfferings } from "../../api/sabiApi";
import { LoadState, PageShell, formatNaira } from "../hospitals/hospitalShared";
import { getCategory, initials, toOffering } from "./wellnessStore";

export function PractitionerListPage() {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const category = getCategory(categoryId);
  const offerings = useApiData(async () => (await listWellnessOfferings({ category: categoryId })).items.map(toOffering), [categoryId]);

  return (
    <PageShell placeholder="Search wellness services..." mainClassName="sabi-main sabi-wellness-main">
      <button className="sabi-rxd-back" onClick={() => navigate("/wellness-hub")}>
        <ArrowLeft size={18} /> Back to Wellness Hub
      </button>

      <div className="sabi-wellness-list-header">
        <div>
          <h1>{category?.label || "Wellness services"}</h1>
          <p>{category?.description || "Services from verified providers."}</p>
        </div>
      </div>

      <LoadState loading={offerings.loading} error={offerings.error} onRetry={offerings.reload} label="Loading services…">
        {(offerings.data || []).length === 0 ? (
          <div className="sabi-card sabi-live-state">
            <Sparkles size={32} />
            <h3>No services here yet</h3>
            <p>Verified providers haven&apos;t published {category ? category.label.toLowerCase() : "services"} on Sabi yet. Check back soon.</p>
          </div>
        ) : (
          <div className="sabi-doctor-card-grid">
            {offerings.data.map((o) => (
              <article className="sabi-doctor-card sabi-card" key={o.id}>
                <div className="sabi-doctor-photo" aria-hidden="true">{initials(o.providerName)}</div>
                <div className="sabi-doctor-card-body">
                  <div className="sabi-doctor-card-title">
                    <strong>{o.name}</strong>
                    <span><BadgeCheck size={14} /> {o.providerName}</span>
                  </div>
                  {o.providerDetail && <p>{o.providerDetail}</p>}
                  {o.description && <p>{o.description.length > 140 ? `${o.description.slice(0, 140)}…` : o.description}</p>}
                  <p className="available">{o.price > 0 ? formatNaira(o.price) : "Price on request"}</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="sabi-doctor-outline" onClick={() => navigate(`/wellness-hub/${categoryId}/${o.id}`)}>View Details</button>
                    <button type="button" className="sabi-doctor-primary" onClick={() => navigate(`/wellness-hub/${categoryId}/${o.id}/book`)}>Book</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </LoadState>
    </PageShell>
  );
}

export default PractitionerListPage;

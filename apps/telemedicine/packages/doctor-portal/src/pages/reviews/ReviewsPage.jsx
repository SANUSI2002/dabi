import React, { useMemo, useState, useSyncExternalStore } from "react";
import { Star, Reply } from "lucide-react";
import { PageTransition } from "design-system";
import PortalLayout from "../../components/PortalLayout";
import { getReviews, subscribeToReviews, replyToReview } from "../../store/reviewStore";
import { addActivity } from "../../store/activityStore";
import "./ReviewsPage.css";

function Stars({ n }) {
  return (
    <span className="dp-review-stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={14} fill={i <= n ? "#f59e0b" : "none"} color={i <= n ? "#f59e0b" : "#cbd5e1"} />
      ))}
    </span>
  );
}

export function ReviewsPage() {
  const reviews = useSyncExternalStore(subscribeToReviews, getReviews, getReviews);
  const [replyingId, setReplyingId] = useState(null);
  const [draft, setDraft] = useState("");

  const { average, distribution } = useMemo(() => {
    if (reviews.length === 0) return { average: 0, distribution: [0, 0, 0, 0, 0] };
    const distribution = [0, 0, 0, 0, 0];
    reviews.forEach((r) => distribution[r.rating - 1]++);
    const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    return { average, distribution };
  }, [reviews]);

  function startReply(r) {
    setReplyingId(r.id);
    setDraft(r.reply || "");
  }
  function submitReply(id) {
    replyToReview(id, draft.trim());
    addActivity(`Replied to a patient review.`);
    setReplyingId(null);
  }

  return (
    <PortalLayout topbarProps={{ placeholder: "Search reviews..." }}>
      <PageTransition className="dp-reviews-page">
        <h1>Patient Reviews</h1>
        <p className="dp-reviews-sub">Manage and respond to patient feedback.</p>

        <div className="dp-reviews-summary">
          <div className="dp-panel dp-reviews-avg-card">
            <div className="dp-reviews-avg-num">{average.toFixed(1)}</div>
            <Stars n={Math.round(average)} />
            <div className="dp-reviews-avg-sub">Based on {reviews.length} reviews</div>
          </div>
          <div className="dp-panel dp-reviews-dist-card">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = distribution[star - 1];
              const pct = reviews.length ? Math.round((count / reviews.length) * 100) : 0;
              return (
                <div className="dp-reviews-dist-row" key={star}>
                  <span>{star} Stars</span>
                  <div className="dp-reviews-dist-track">
                    <div className="dp-reviews-dist-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="dp-reviews-list">
          {reviews.map((r) => (
            <div className="dp-panel dp-review-card" key={r.id}>
              <div className="dp-review-header">
                <div className="dp-review-avatar">
                  {r.patientName === "Anonymous Patient"
                    ? "?"
                    : r.patientName
                        .split(" ")
                        .map((p) => p[0])
                        .join("")
                        .slice(0, 2)}
                </div>
                <div className="dp-review-header-info">
                  <strong>{r.patientName}</strong>
                  <div className="dp-review-meta">
                    <Stars n={r.rating} /> <span>· {r.date}</span>
                  </div>
                  <span className="dp-tag dp-tag-neutral">{r.context}</span>
                </div>
                {!r.reply && replyingId !== r.id && (
                  <button className="dp-link-btn dp-review-reply-btn" onClick={() => startReply(r)}>
                    <Reply size={14} /> Reply
                  </button>
                )}
              </div>
              <p className="dp-review-text">{r.text}</p>

              {r.reply && replyingId !== r.id && (
                <div className="dp-review-reply">
                  <div className="dp-review-reply-label">Your Reply</div>
                  <p>{r.reply}</p>
                  <button className="dp-text-btn" onClick={() => startReply(r)}>
                    Edit reply
                  </button>
                </div>
              )}

              {replyingId === r.id && (
                <div className="dp-review-reply-form">
                  <textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a public reply..." />
                  <div className="dp-modal-actions">
                    <button className="dp-btn dp-btn-outline" onClick={() => setReplyingId(null)}>
                      Cancel
                    </button>
                    <button className="dp-btn dp-btn-primary" onClick={() => submitReply(r.id)}>
                      Post reply
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </PageTransition>
    </PortalLayout>
  );
}

export default ReviewsPage;

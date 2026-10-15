import { useState } from "react";
import { ArrowLeft, Check, Map as MapIcon, MapPin, PackageCheck, Phone, RefreshCw, ShieldCheck, Store, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { riderDate, riderStatus, type RiderAssignment } from "./types";
import { RiderLocationAndIssues } from "./RiderOperations";

type Props = {
  assignment: RiderAssignment;
  busy: boolean;
  error: string;
  onAction: (kind: string, body?: Record<string, unknown>) => Promise<void>;
  onRefresh?: () => void;
};
const naira = (minor: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(minor / 100);
const tone = (item: RiderAssignment) =>
  item.assignmentStatus === "PENDING" ? "is-accent" : item.assignmentStatus === "COMPLETED" ? "is-success" : item.assignmentStatus === "REJECTED" ? "is-neutral" : "is-info";

export default function RiderDelivery({ assignment: item, busy, error, onAction, onRefresh }: Props) {
  const [code, setCode] = useState("");
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const pickup = item.fulfilmentStatus === "READY_FOR_PICKUP";
  const stage = pickup ? "collection" : "delivery";
  const steps = ["Accepted", "Collected", "On the way", "Delivered"];
  const progress = item.assignmentStatus === "PENDING" || item.assignmentStatus === "REJECTED" ? -1
    : item.assignmentStatus === "COMPLETED" ? 3
      : pickup ? 0
        : item.fulfilmentStatus === "PICKED_UP" ? 1
          : 2;
  const finished = item.assignmentStatus === "COMPLETED" || item.assignmentStatus === "REJECTED";

  return (
    <div className="rider-delivery">
      <div className="rider-delivery-head">
        <Link className="rider-text-link" to={finished ? "/rider/history" : "/rider/offers"}><ArrowLeft size={17} aria-hidden="true" /> {finished ? "Back to history" : "Back to deliveries"}</Link>
        {onRefresh && <button className="rider-button-ghost" disabled={busy} onClick={onRefresh}><RefreshCw size={16} aria-hidden="true" />Refresh</button>}
      </div>
      <div className="rider-page-heading">
        <div>
          <p className="rider-eyebrow">{item.assignmentStatus === "PENDING" ? "New offer" : "Your delivery"}</p>
          <h1>{item.reference}</h1>
        </div>
        <span className={`rider-status ${tone(item)}`}>{riderStatus(item)}</span>
      </div>
      {item.assignmentStatus !== "REJECTED" && (
        <ol className="rider-stepper" aria-label="Delivery progress">
          {steps.map((step, i) => (
            <li key={step} aria-current={i === progress ? "step" : undefined} className={i <= progress ? "is-complete" : ""}>
              <span>{i <= progress ? <Check size={16} aria-hidden="true" /> : i + 1}</span>
              <strong>{step}</strong>
            </li>
          ))}
        </ol>
      )}

      <div className="rider-delivery-grid">
        {/* What to do now comes first on a phone. */}
        <section className="rider-card rider-action-card" aria-label="Handover confirmation" style={{ order: 0 }}>
          {item.earningOfferMinor != null ? (
            <div className="rider-earning-line">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Wallet size={17} aria-hidden="true" />{item.assignmentStatus === "COMPLETED" ? "You earned" : "You earn on delivery"}</span>
              <strong>{naira(item.earningOfferMinor)}</strong>
            </div>
          ) : (
            <p className="rider-caption">Contact operations for this assignment’s earning offer.</p>
          )}
          {error && <p role="alert" className="rider-alert rider-alert-error">{error}</p>}

          {item.assignmentStatus === "PENDING" && (
            <>
              <div className="rider-stack-sm">
                <h2>Take this collection?</h2>
                <p className="rider-muted">Check the pharmacy location, then accept before you collect the package.</p>
              </div>
              <button className="rider-button rider-button-lg rider-block" disabled={busy} onClick={() => onAction("accept")}>{busy ? "Saving…" : "Accept collection"}</button>
              {!declining ? (
                <button className="rider-button-ghost" disabled={busy} onClick={() => setDeclining(true)} aria-expanded={declining}>Decline</button>
              ) : (
                <form className="rider-form" onSubmit={(e) => { e.preventDefault(); onAction("reject", { reason: reason.trim() }); }}>
                  <div className="rider-field">
                    <label htmlFor="decline-reason">Reason for declining</label>
                    <textarea id="decline-reason" value={reason} maxLength={300} required disabled={busy} onChange={(e) => setReason(e.target.value)} />
                    <small>For example: too far, vehicle problem, finishing another delivery.</small>
                  </div>
                  <div className="rider-actions">
                    <button className="rider-button-danger" disabled={busy || !reason.trim()}>Confirm decline</button>
                    <button type="button" className="rider-button-ghost" onClick={() => setDeclining(false)}>Cancel</button>
                  </div>
                </form>
              )}
            </>
          )}

          {item.assignmentStatus === "ACCEPTED" && ["READY_FOR_PICKUP", "OUT_FOR_DELIVERY"].includes(item.fulfilmentStatus) && (
            <form className="rider-form" onSubmit={async (e) => {
              e.preventDefault();
              await onAction("status", { status: pickup ? "PICKED_UP" : "DELIVERED", code });
              setCode("");
            }}>
              <div className="rider-stack-sm">
                <h2>{pickup ? "Collect the package" : "Hand over the package"}</h2>
                <p id="code-help" className="rider-muted">
                  {pickup ? "Ask the pharmacy for its collection code when they give you the package." : "Ask the recipient for their delivery code only when you hand over the package."}
                </p>
              </div>
              <div className="rider-field">
                <label htmlFor="handover-code">Six-digit {stage} code</label>
                <input id="handover-code" className="rider-input rider-code-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required
                  value={code} aria-describedby="code-help" disabled={busy} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
              </div>
              <button className="rider-button rider-button-lg rider-block" disabled={busy || code.length !== 6}>
                {busy ? "Verifying…" : pickup ? "Verify package collected" : "Verify successful delivery"}
              </button>
              <p className="rider-caption"><ShieldCheck size={13} aria-hidden="true" style={{ verticalAlign: "-2px" }} /> Only a valid code confirms the handover. Keep the package until it is verified.</p>
            </form>
          )}

          {item.assignmentStatus === "ACCEPTED" && item.fulfilmentStatus === "PICKED_UP" && (
            <>
              <span className="rider-feature-icon"><PackageCheck aria-hidden="true" /></span>
              <div className="rider-stack-sm">
                <h2>Collection confirmed.</h2>
                <p className="rider-muted">You have the package. Start the delivery when you are ready to leave for the recipient.</p>
              </div>
              <button className="rider-button rider-button-lg rider-block" disabled={busy} onClick={() => onAction("status", { status: "OUT_FOR_DELIVERY" })}>{busy ? "Saving…" : "Start delivery"}</button>
            </>
          )}

          {item.assignmentStatus === "COMPLETED" && (
            <div className="rider-celebrate">
              <PackageCheck size={40} aria-hidden="true" />
              <h2>Delivered successfully.</h2>
              <p className="rider-muted">The recipient’s code confirmed this handover. It is now in your history.</p>
              <div className="rider-actions">
                <Link className="rider-button" to="/rider/offers">Find your next delivery</Link>
                <Link className="rider-button-secondary" to="/rider/history">View delivery history</Link>
              </div>
            </div>
          )}

          {item.assignmentStatus === "REJECTED" && (
            <>
              <div className="rider-stack-sm">
                <h2>Assignment declined.</h2>
                <p className="rider-muted">This package was not collected by you.</p>
              </div>
              <Link className="rider-button-secondary" to="/rider/offers">View other assignments</Link>
            </>
          )}
        </section>

        <section className="rider-card rider-addresses" aria-label="Delivery addresses">
          <Address label="Collect from" kind="pickup" name={item.pickup.name} address={item.pickup.address} phone={item.pickup.contactPhone} />
          {item.recipient ? (
            <Address label="Deliver to" kind="dropoff" name={item.recipient.recipientName} address={item.recipient.address} phone={item.recipient.recipientPhone} />
          ) : (
            <div className="rider-private-note">
              <ShieldCheck size={20} aria-hidden="true" />
              <p>{item.assignmentStatus === "PENDING" ? "Recipient contact details are shared after you accept this collection." : "Recipient contact details are no longer available for this assignment."}</p>
            </div>
          )}
          <dl className="rider-timeline">
            <div><dt>Assigned</dt><dd>{riderDate(item.assignedAt)}</dd></div>
            {item.pickedUpAt && <div><dt>Collected</dt><dd>{riderDate(item.pickedUpAt)}</dd></div>}
            {item.deliveredAt && <div><dt>Delivered</dt><dd>{riderDate(item.deliveredAt)}</dd></div>}
          </dl>
        </section>
      </div>
      <RiderLocationAndIssues assignment={item} />
    </div>
  );
}

function Address({ label, kind, name, address, phone }: { label: string; kind: "pickup" | "dropoff"; name: string; address: string; phone?: string | null }) {
  const safePhone = (phone ?? "").replace(/[^\d+]/g, "");
  const Icon = kind === "pickup" ? Store : MapPin;
  return (
    <div className={`rider-address${kind === "dropoff" ? " is-dropoff" : ""}`}>
      <span className="rider-address-icon"><Icon size={20} aria-hidden="true" /></span>
      <div>
        <p className="rider-eyebrow">{label}</p>
        <h2>{name}</h2>
        <p className="rider-muted">{address}</p>
        <div className="rider-address-actions">
          {safePhone && <a className="rider-button-secondary" href={`tel:${safePhone}`} aria-label={`Call ${name}, ${phone}`}><Phone size={16} aria-hidden="true" />Call</a>}
          {address && <a className="rider-button-secondary" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer"><MapIcon size={16} aria-hidden="true" />Directions</a>}
        </div>
      </div>
    </div>
  );
}

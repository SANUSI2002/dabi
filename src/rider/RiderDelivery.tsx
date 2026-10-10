import { useState } from "react";
import {
  ArrowLeft,
  Check,
  MapPin,
  PackageCheck,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { riderDate, riderStatus, type RiderAssignment } from "./types";

type Props = {
  assignment: RiderAssignment;
  busy: boolean;
  error: string;
  onAction: (kind: string, body?: Record<string, unknown>) => Promise<void>;
};
export default function RiderDelivery({
  assignment: item,
  busy,
  error,
  onAction,
}: Props) {
  const [code, setCode] = useState("");
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const pickup = item.fulfilmentStatus === "READY_FOR_PICKUP";
  const stage = pickup ? "collection" : "delivery";
  const steps = ["Accepted", "Collected", "On the way", "Delivered"];
  const progress =
    item.assignmentStatus === "PENDING" || item.assignmentStatus === "REJECTED"
      ? -1
      : item.assignmentStatus === "COMPLETED"
        ? 3
        : pickup
          ? 0
          : item.fulfilmentStatus === "PICKED_UP"
            ? 1
            : 2;
  return (
    <>
      <Link
        className="rider-text-link"
        to={
          item.assignmentStatus === "COMPLETED" ||
          item.assignmentStatus === "REJECTED"
            ? "/rider/history"
            : "/rider/offers"
        }
      >
        <ArrowLeft size={17} aria-hidden="true" /> Back to deliveries
      </Link>
      <div className="rider-page-heading">
        <div>
          <p className="rider-eyebrow">Your delivery</p>
          <h1>{item.reference}</h1>
        </div>
        <span className="rider-status">{riderStatus(item)}</span>
      </div>
      <ol className="rider-stepper" aria-label="Delivery progress">
        {steps.map((step, i) => (
          <li
            key={step}
            aria-current={i === progress ? "step" : undefined}
            className={i <= progress ? "is-complete" : ""}
          >
            <span>
              {i <= progress ? <Check size={16} aria-hidden="true" /> : i + 1}
            </span>
            <strong>{step}</strong>
          </li>
        ))}
      </ol>
      <div className="rider-delivery-grid">
        <section
          className="rider-card rider-addresses"
          aria-label="Delivery addresses"
        >
          <Address
            label="Collect from"
            name={item.pickup.name}
            address={item.pickup.address}
            phone={item.pickup.contactPhone}
          />
          {item.recipient ? (
            <Address
              label="Deliver to"
              name={item.recipient.recipientName}
              address={item.recipient.address}
              phone={item.recipient.recipientPhone}
            />
          ) : (
            <div className="rider-private-note">
              <ShieldCheck size={20} aria-hidden="true" />
              <p>
                {item.assignmentStatus === "PENDING"
                  ? "Recipient contact details are shared after you accept this collection."
                  : "Recipient contact details are no longer available for this assignment."}
              </p>
            </div>
          )}
          <dl className="rider-timeline">
            <div>
              <dt>Assigned</dt>
              <dd>{riderDate(item.assignedAt)}</dd>
            </div>
            {item.pickedUpAt && (
              <div>
                <dt>Collected</dt>
                <dd>{riderDate(item.pickedUpAt)}</dd>
              </div>
            )}
            {item.deliveredAt && (
              <div>
                <dt>Delivered</dt>
                <dd>{riderDate(item.deliveredAt)}</dd>
              </div>
            )}
          </dl>
        </section>
        <section
          className="rider-card rider-action-card"
          aria-label="Handover confirmation"
        >
          {error && (
            <p role="alert" className="rider-alert rider-alert-error">
              {error}
            </p>
          )}
          {item.assignmentStatus === "PENDING" && (
            <>
              <span className="rider-feature-icon">
                <PackageCheck aria-hidden="true" />
              </span>
              <h2>Ready for your next collection?</h2>
              <p className="rider-muted">
                Check the pharmacy location, then accept this assignment before
                collecting the package.
              </p>
              <button
                className="rider-button"
                disabled={busy}
                onClick={() => onAction("accept")}
              >
                {busy ? "Saving…" : "Accept collection"}
              </button>
              <button
                className="rider-button-secondary"
                disabled={busy}
                onClick={() => setDeclining(!declining)}
                aria-expanded={declining}
              >
                Decline
              </button>
              {declining && (
                <form
                  className="rider-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    onAction("reject", { reason: reason.trim() });
                  }}
                >
                  <label htmlFor="decline-reason">Reason for declining</label>
                  <textarea
                    id="decline-reason"
                    className="rider-input"
                    value={reason}
                    maxLength={300}
                    required
                    disabled={busy}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <button
                    className="rider-button-secondary"
                    disabled={busy || !reason.trim()}
                  >
                    Confirm decline
                  </button>
                  <button
                    type="button"
                    className="rider-text-link"
                    onClick={() => setDeclining(false)}
                  >
                    Cancel
                  </button>
                </form>
              )}
            </>
          )}
          {item.assignmentStatus === "ACCEPTED" &&
            ["READY_FOR_PICKUP", "OUT_FOR_DELIVERY"].includes(
              item.fulfilmentStatus,
            ) && (
              <form
                className="rider-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await onAction("status", {
                    status: pickup ? "PICKED_UP" : "DELIVERED",
                    code,
                  });
                  setCode("");
                }}
              >
                <span className="rider-feature-icon">
                  <ShieldCheck aria-hidden="true" />
                </span>
                <h2>Confirm {stage}</h2>
                <p id="code-help" className="rider-muted">
                  {pickup
                    ? "Ask the pharmacy for its collection code when receiving the package."
                    : "Ask the recipient for their delivery code only when handing over the package."}
                </p>
                <label htmlFor="handover-code">Six-digit {stage} code</label>
                <input
                  id="handover-code"
                  className="rider-input rider-code-input"
                  inputMode="numeric"
                  autoComplete="off"
                  pattern="[0-9]{6}"
                  minLength={6}
                  maxLength={6}
                  required
                  value={code}
                  aria-describedby="code-help"
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  disabled={busy}
                />
                <button
                  className="rider-button"
                  disabled={busy || code.length !== 6}
                >
                  {busy
                    ? "Verifying…"
                    : pickup
                      ? "Verify package collected"
                      : "Verify successful delivery"}
                </button>
                <p className="rider-caption">
                  Only a valid code confirms the handover. Keep the package
                  until it is verified.
                </p>
              </form>
            )}
          {item.assignmentStatus === "ACCEPTED" &&
            item.fulfilmentStatus === "PICKED_UP" && (
              <>
                <span className="rider-feature-icon">
                  <PackageCheck aria-hidden="true" />
                </span>
                <h2>Collection confirmed.</h2>
                <p className="rider-muted">
                  You have the package. Start the delivery when you are ready to
                  leave for the recipient.
                </p>
                <button
                  className="rider-button"
                  disabled={busy}
                  onClick={() =>
                    onAction("status", { status: "OUT_FOR_DELIVERY" })
                  }
                >
                  {busy ? "Saving…" : "Start delivery"}
                </button>
              </>
            )}
          {item.assignmentStatus === "COMPLETED" && (
            <>
              <span className="rider-feature-icon">
                <PackageCheck aria-hidden="true" />
              </span>
              <h2>Delivered successfully.</h2>
              <p className="rider-muted">
                The recipient's code confirmed this handover. Your delivery is
                now in your history.
              </p>
              <Link className="rider-button" to="/rider/history">
                View delivery history
              </Link>
            </>
          )}
          {item.assignmentStatus === "REJECTED" && (
            <>
              <h2>Assignment declined.</h2>
              <p className="rider-muted">
                This package was not collected by you.
              </p>
              <Link className="rider-button-secondary" to="/rider/offers">
                View other assignments
              </Link>
            </>
          )}
        </section>
      </div>
    </>
  );
}
function Address({
  label,
  name,
  address,
  phone,
}: {
  label: string;
  name: string;
  address: string;
  phone: string;
}) {
  const safePhone = phone.replace(/[^\d+]/g, "");
  return (
    <div className="rider-address">
      <span className="rider-address-icon">
        <MapPin size={20} aria-hidden="true" />
      </span>
      <div>
        <p className="rider-eyebrow">{label}</p>
        <h2>{name}</h2>
        <p className="rider-muted">{address}</p>
        {safePhone && (
          <a className="rider-text-link" href={`tel:${safePhone}`}>
            <Phone size={16} aria-hidden="true" />
            {phone}
          </a>
        )}
      </div>
    </div>
  );
}

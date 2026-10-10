import React, { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { getDeliveryCodes, renewDeliveryCode } from "../../api/commerceApi";
import "./DeliveryCodes.css";

export default function DeliveryCodes({ orderId, enabled = true }) {
  const pendingAction = useRef(false);
  const [items, setItems] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    setItems(null);
    setError("");
    if (enabled)
      getDeliveryCodes(orderId)
        .then((data) => {
          if (active) setItems(data);
        })
        .catch((e) => {
          if (active) setError(e.message || "Could not load delivery codes.");
        });
    return () => {
      active = false;
    };
  }, [orderId, enabled]);
  async function run(work, success = "") {
    if (pendingAction.current) return;
    pendingAction.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
      setItems(await getDeliveryCodes(orderId));
      setMessage(success);
    } catch (e) {
      setError(e.message || "Could not update delivery codes.");
    } finally {
      pendingAction.current = false;
      setBusy(false);
    }
  }
  if (!enabled) return null;
  return (
    <section
      className="sabi-delivery-codes"
      aria-label="Delivery confirmation codes"
    >
      <h2>
        <ShieldCheck size={20} aria-hidden="true" />
        Your delivery codes
      </h2>
      <p>
        Share a code only when the courier hands you that pharmacy’s package. It
        confirms receipt—not payment.
      </p>
      {error && (
        <p role="alert" className="delivery-code-error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {!items && !error && <p role="status">Loading delivery codes…</p>}
      {items?.map((item) => (
        <article key={item.fulfilmentId}>
          <h3>{item.pharmacyName}</h3>
          {item.assignment?.deliveredAt ? (
            <p>
              Delivered {new Date(item.assignment.deliveredAt).toLocaleString()}
            </p>
          ) : item.code ? (
            <>
              <p
                className="delivery-secret"
                aria-label={`Delivery code ${item.code.split("").join(" ")}`}
              >
                {item.code}
              </p>
              <p>Valid until {new Date(item.expiresAt).toLocaleString()}</p>
            </>
          ) : item.expired ? (
            <p>
              Your code has expired. Generate a new one before receiving this
              package.
            </p>
          ) : (
            <p>Your code appears after the courier confirms collection.</p>
          )}
          {item.lockedUntil && new Date(item.lockedUntil) > new Date() && (
            <p>
              Verification locked until{" "}
              {new Date(item.lockedUntil).toLocaleTimeString()}. Replacing the
              code does not remove the lock.
            </p>
          )}
          {["PICKED_UP", "OUT_FOR_DELIVERY"].includes(
            item.fulfilmentStatus,
          ) && (
            <button
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    "Generate a new delivery code? The previous code will stop working.",
                  )
                )
                  run(
                    () => renewDeliveryCode(item.fulfilmentId),
                    "New delivery code generated. The previous code is invalid.",
                  );
              }}
            >
              Generate new code
            </button>
          )}
        </article>
      ))}
      {items?.length === 0 && <p>No home-delivery packages in this order.</p>}
      <button disabled={busy} onClick={() => run(() => Promise.resolve())}>
        {busy ? "Updating…" : "Refresh codes"}
      </button>
    </section>
  );
}
